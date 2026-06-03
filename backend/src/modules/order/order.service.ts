import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { CreateOrderLineItem } from './cqrs/commands/create-order.command';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

import { AppConfigService } from '../../common/config';
import {
  logErrorNormalized,
  logErrorAndThrow,
  logWarnNormalized,
} from '../../common/shared/helpers/error.util';
import { RedisLockService } from '../../infrastructure/locks/redis-lock.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  CaptureCheckoutOrderCommand,
  type CaptureCheckoutOrderResult,
} from '../payment/cqrs/commands/payment-gateway.command';
import { OrderStatus, type OrderStatusCode } from './enums/order-status.enum';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { RowLockService } from '../../infrastructure/database/prisma/locks/row-lock.service';
import {
  buildOrderEventsPage,
  buildOrderListPage,
  isAlreadyCapturedError,
} from './helpers/order.helper';

/** ----- Handle order business service. ----- **/
@Injectable()
export class OrderService implements OnModuleInit {
  private readonly log = new Logger(OrderService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLocks: RowLockService,
    private readonly inventory: InventoryService,
    private readonly queue: QueueService,
    private readonly cfg: AppConfigService,
    private readonly redisLock: RedisLockService,
    private readonly commandBus: CommandBus,
  ) {}

  /** ----- Acquire Redis lock or reject when busy. ----- **/
  private async withLock<T>(
    key: string,
    ttlMs: number,
    busyMessage: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lock = await this.redisLock.tryAcquire(key, ttlMs);
    if (!lock) throw new BadRequestException(busyMessage);

    try {
      return await fn();
    } finally {
      await this.redisLock.release(lock);
    }
  }

  /** ----- Whether mock payment gateway is enabled. ----- **/
  private isMockPaymentGatewayEnabled(): boolean {
    return this.cfg.isMockPaymentGateway;
  }

  /** ----- Initialize order module jobs ----- **/
  async onModuleInit(): Promise<void> {
    // Initialize and upsert expire orders sweep job on module init
    await this.upsertExpireOrdersSweep(this.cfg.order.expireSweepEveryMs).catch(
      (err: unknown) => {
        logErrorNormalized(
          this.log,
          err,
          'Upsert expire sweep failed',
          'Failed to upsert expire orders sweep job',
        );
      },
    );
  }

  /** ----- Validate line item total matches order amount. ----- **/
  private validateOrderAmount(
    amount: number,
    items: CreateOrderLineItem[] | undefined,
  ): void {
    if (!items || items.length === 0) return;

    const expected = Number(
      items
        .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        .toFixed(2),
    );
    if (Math.abs(expected - amount) > 0.001) {
      throw new BadRequestException(
        `Order amount ${amount} does not match line items total ${expected}`,
      );
    }
  }

  /** ----- Create order record. ----- **/
  async createOrder(params: {
    amount: number;
    currency?: string;
    externalRef?: string;
    items?: CreateOrderLineItem[];
  }): Promise<{ id: string; idempotencyKey: string }> {
    this.validateOrderAmount(params.amount, params.items);
    // Set currency, falling back to config or MYR default
    const currency = (
      params.currency ?? this.cfg.paypal.currency
    ).toUpperCase();

    // Generate unique idempotency key for this order
    const idempotencyKey = `order_${randomUUID()}`;

    // Create order record in the database repository
    const order = await this.insertOrder({
      amount: params.amount,
      currency,
      externalRef: params.externalRef,
      idempotencyKey,
      items: params.items,
    });

    // Return new order id and idempotency key for caller
    return { id: order.id, idempotencyKey: order.idempotencyKey };
  }

  /** ----- Create payment intent and enqueue checkout creation. ----- **/
  async createPaymentIntent(orderId: string): Promise<{
    provider: 'PAYPAL' | 'MOCK';
    orderId: string;
    status: string;
    mock: boolean;
    internalOrderId: string;
    paypalOrderId: string | null;
    approvalUrl: string | null;
    message: string;
  }> {
    // Acquire redis lock for payment intent creation
    try {
      return await this.withLock(
        `lock:order:intent:${orderId}`,
        15000,
        'Payment intent request is already in progress. Please retry shortly.',
        async () => {
          // Determine if mock payment gateway is enabled
          const mockEnabled = this.isMockPaymentGatewayEnabled();
          // Set provider based on whether mock is enabled
          const provider: 'PAYPAL' | 'MOCK' = mockEnabled ? 'MOCK' : 'PAYPAL';

          // Lock order for payment intent processing
          const locked = await this.lockOrderForPaymentIntent({
            orderId,
            mockEnabled,
          });

          // Enqueue creation job if required by order logic
          if (locked.shouldEnqueue) {
            await this.queue.createPaymentIntent(locked.orderId);
          }

          // Build and return result object to caller
          return {
            provider,
            orderId: locked.orderId,
            status: locked.status,
            mock: mockEnabled,
            internalOrderId: locked.orderId,
            paypalOrderId: locked.paypalOrderId,
            approvalUrl: locked.approvalUrl,
            message: 'Checkout creation scheduled.',
          };
        },
      );
    } catch (error: unknown) {
      // Log and rethrow errors encountered during payment intent creation
      return logErrorAndThrow(
        this.log,
        error,
        'Create payment intent failed',
        `CreatePaymentIntent failed: ${orderId}`,
      );
    }
  }

  /** ----- Schedule capture payment job ----- **/
  async scheduleCapturePayment(orderId: string): Promise<{
    orderId: string;
    status: OrderStatusCode;
    paypalOrderId: string;
    message: string;
  }> {
    // Attempt to acquire capture lock for order id
    try {
      return await this.withLock(
        `lock:order:capture:${orderId}`,
        15000,
        'Capture request is already in progress. Please retry shortly.',
        async () => {
          // Retrieve the order by the given orderId
          const order = await this.findOrderById(orderId);
          if (!order) throw new NotFoundException('Order not found');
          // Ensure the order has an associated PayPal ID
          if (!order.paypalOrderId) {
            throw new BadRequestException('Order has no PayPal order id');
          }

          // If already paid, return with paid status for order
          if (order.status === OrderStatus.PAID) {
            return {
              orderId: order.id,
              status: OrderStatus.PAID as OrderStatusCode,
              paypalOrderId: order.paypalOrderId,
              message: 'Order already paid.',
            };
          }

          // Only allow capture if status is PROCESSING or FAILED
          if (
            order.status !== OrderStatus.PROCESSING &&
            order.status !== OrderStatus.FAILED
          ) {
            throw new BadRequestException(
              `Order must be FAILED or PROCESSING to capture (got: ${order.status})`,
            );
          }

          // Attempt to enqueue capture payment job
          try {
            await this.queue.capturePayment(order.id);
          } catch (error: unknown) {
            // Log warning if enqueuing capture fails
            logWarnNormalized(
              this.log,
              error,
              'Schedule capture failed',
              `Capture job may already exist: ${order.id}`,
            );
          }

          // Return response indicating capture was scheduled now
          return {
            orderId: order.id,
            status: OrderStatus.PROCESSING as OrderStatusCode,
            paypalOrderId: order.paypalOrderId,
            message: 'Capture scheduled.',
          };
        },
      );
    } catch (error: unknown) {
      // Log and rethrow on schedule capture payment error
      return logErrorAndThrow(
        this.log,
        error,
        'Schedule capture payment failed',
        `ScheduleCapturePayment failed: ${orderId}`,
      );
    }
  }

  /** ----- Capture payment for order. ----- **/
  async capturePayment(orderId: string): Promise<{
    orderId: string;
    status: OrderStatusCode;
    paypalOrderId: string;
    message: string;
  }> {
    // Attempt to capture payment for the given order
    try {
      // Lock order for capture to avoid race conditions
      const locked = await this.lockOrderForCapture(orderId);

      // If order should not be captured, return early
      if (!locked.shouldCapture) {
        return {
          orderId: locked.orderId,
          status: locked.status,
          paypalOrderId: locked.paypalOrderId,
          message: locked.message,
        };
      }

      // Determine next status and result of capture attempt
      let nextStatus: typeof OrderStatus.PAID | typeof OrderStatus.FAILED;
      let captureSucceeded = false;
      try {
        // Execute capture command via command bus
        const captured = await this.commandBus.execute<
          CaptureCheckoutOrderCommand,
          CaptureCheckoutOrderResult
        >(new CaptureCheckoutOrderCommand(locked.paypalOrderId));
        captureSucceeded = captured.success;
        nextStatus = captured.success ? OrderStatus.PAID : OrderStatus.FAILED;
      } catch (error) {
        // If already captured, treat as PAID; else throw error
        if (!isAlreadyCapturedError(error)) throw error;
        nextStatus = OrderStatus.PAID;
        captureSucceeded = true;
      }

      // Update capture status for the order if needed
      await this.updateCaptureStatusIfNeeded({
        orderId,
        nextStatus,
      });

      // Return result with order and capture status details
      return {
        orderId: locked.orderId,
        status: nextStatus as OrderStatusCode,
        paypalOrderId: locked.paypalOrderId,
        message: captureSucceeded
          ? 'Payment captured successfully.'
          : 'Payment capture failed.',
      };
    } catch (error: unknown) {
      // Log and throw on payment capture failure
      return logErrorAndThrow(
        this.log,
        error,
        'Capture payment failed',
        `CapturePayment failed: ${orderId}`,
      );
    }
  }

  /** ----- Get order with paginated events ----- **/
  async getOrderWithEvents(params: {
    id: string;
    eventsCursor: string | null;
    eventsLimit: number;
    eventsDirection: 'asc' | 'desc';
  }) {
    // Fetch one more event to determine if there's a next page
    const eventsTake = params.eventsLimit + 1;
    // Retrieve order with associated events using repository
    const order = await this.queryOrderWithEvents({
      id: params.id,
      eventsCursor: params.eventsCursor,
      eventsTake: eventsTake,
      eventsDirection: params.eventsDirection,
    });

    // Throw error if order does not exist in DB
    if (!order) throw new NotFoundException('Order not found');

    // Build and return paginated order events page response
    return buildOrderEventsPage({
      order,
      eventsLimit: params.eventsLimit,
      eventsDirection: params.eventsDirection,
    });
  }

  /** ----- List orders with cursor pagination ----- **/
  async listOrders(params: {
    cursor: string | null;
    limit: number;
    direction: 'asc' | 'desc';
  }) {
    // Fetch one more order to check for next page
    const take = params.limit + 1;
    // Retrieve a list of orders from the repository
    const orders = await this.queryOrders({
      cursor: params.cursor,
      take,
      direction: params.direction,
    });

    // Build paginated response using list of orders
    return buildOrderListPage({
      orders,
      limit: params.limit,
      direction: params.direction,
    });
  }

  /** ----- Upsert expire orders sweep schedule ----- **/
  // Set up or update order expiration sweep schedule
  async upsertExpireOrdersSweep(everyMs: number): Promise<void> {
    await this.queue.upsertExpireOrdersSweep(everyMs);
  }

  /** ----- Create order record (persistence) ----- **/
  insertOrder(params: {
    amount: number;
    currency: string;
    externalRef?: string;
    idempotencyKey: string;
    items?: CreateOrderLineItem[];
  }) {
    const { items, ...orderData } = params;
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          amount: new Prisma.Decimal(orderData.amount),
          currency: orderData.currency,
          externalRef: orderData.externalRef,
          idempotencyKey: orderData.idempotencyKey,
          status: OrderStatus.UNPAID,
        },
      });

      if (items && items.length > 0) {
        await tx.orderLineItem.createMany({
          data: items.map((item) => ({
            orderId: order.id,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
          })),
        });
        await this.inventory.reserveAtCheckout(order.id, tx);
      }

      return order;
    });
  }

  /** ----- Lock order for payment intent ----- **/
  lockOrderForPaymentIntent(params: { orderId: string; mockEnabled: boolean }) {
    const { orderId, mockEnabled } = params;

    // Begin a database transaction to securely lock the order row.
    return this.prisma.$transaction(async (tx) => {
      const rows = await this.rowLocks.findOrderForPaymentIntent(tx, orderId);

      if (rows.length === 0) throw new NotFoundException('Order not found');

      const order = rows[0];
      const status = String(order.status);

      // If the order is in a terminal (paid/refunded) state, do not proceed.
      if (
        status === OrderStatus.PAID ||
        status === OrderStatus.REFUNDED ||
        status === OrderStatus.PARTIALLY_REFUNDED
      ) {
        // No new payment intent to enqueue—return early.
        return {
          orderId: order.id,
          status,
          paypalOrderId: order.paypalOrderId,
          approvalUrl: null,
          shouldEnqueue: false,
        } as const;
      }

      // Check if the order is already processing and ready for checkout.
      const checkoutReady =
        status === OrderStatus.PROCESSING &&
        !!order.paypalOrderId &&
        (mockEnabled || !!order.approvalUrl);

      // If ready to checkout, return with shouldEnqueue false.
      if (checkoutReady) {
        return {
          orderId: order.id,
          status: OrderStatus.PROCESSING,
          paypalOrderId: order.paypalOrderId,
          approvalUrl: mockEnabled ? null : order.approvalUrl,
          shouldEnqueue: false,
        } as const;
      }

      // Abort if order status is not eligible for a new payment (non-retryable state).
      if (
        status !== OrderStatus.UNPAID &&
        status !== OrderStatus.PROCESSING &&
        status !== OrderStatus.FAILED &&
        status !== OrderStatus.CANCELLED &&
        status !== OrderStatus.EXPIRED
      ) {
        throw new BadRequestException(
          'Order is not in a retryable state to start payment',
        );
      }

      await this.inventory.extendForPayment(order.id, tx);

      // Update the order status to PROCESSING and clear approvalUrl before payment.
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING, approvalUrl: null },
      });

      // Return details for downstream processing with shouldEnqueue true.
      return {
        orderId: order.id,
        status: OrderStatus.PROCESSING,
        paypalOrderId: order.paypalOrderId,
        approvalUrl: null,
        shouldEnqueue: true,
      } as const;
    });
  }

  /** ----- Find order by id ----- **/
  findOrderById(orderId: string) {
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  /** ----- Lock order for capture ----- **/
  lockOrderForCapture(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const orderRows = await this.rowLocks.findOrderForCapture(tx, orderId);

      if (orderRows.length === 0)
        throw new NotFoundException('Order not found');
      const order = orderRows[0];

      // Cast the raw status string to a known OrderStatusCode
      const status = order.status as OrderStatusCode;

      // Check that the order has a PayPal order ID before we proceed
      if (!order.paypalOrderId) {
        throw new BadRequestException('Order has no PayPal order id');
      }

      // If order is already paid, do not allow re-capture; return early with message
      if (status === OrderStatus.PAID) {
        return {
          orderId: order.id,
          paypalOrderId: order.paypalOrderId,
          status: OrderStatus.PAID as OrderStatusCode,
          shouldCapture: false,
          message: 'Order already paid.',
        };
      }

      // Cancelled orders cannot be captured, throw
      if (status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order cancelled; cannot capture');
      }

      // Otherwise, update the order status to PROCESSING to indicate capture in progress
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING },
      });

      // Return necessary info for downstream capture processing
      return {
        orderId: order.id,
        paypalOrderId: order.paypalOrderId,
        status: OrderStatus.PROCESSING as OrderStatusCode,
        shouldCapture: true,
        message: 'Capture started.',
      };
    });
  }

  /** ----- Update capture status when needed ----- **/
  updateCaptureStatusIfNeeded(params: {
    orderId: string;
    nextStatus: typeof OrderStatus.PAID | typeof OrderStatus.FAILED;
  }) {
    // Transactionally update order status if not already paid
    // Prevents redundant updates, ensures status consistency for payment
    // Locks row using SELECT ... FOR UPDATE during transaction step
    // Only updates to PAID or FAILED, skips if order already PAID
    // Returns early if order is not found or already settled
    const { orderId, nextStatus } = params;
    return this.prisma.$transaction(async (tx) => {
      const orderRows = await this.rowLocks.findOrderIdAndStatus(tx, orderId);

      if (orderRows.length === 0) return;
      if (orderRows[0].status === OrderStatus.PAID) return;

      const previousStatus = orderRows[0].status;

      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      if (nextStatus === OrderStatus.PAID) {
        await this.inventory.commitForOrder(orderId, tx);
      } else if (
        nextStatus === OrderStatus.FAILED &&
        previousStatus === OrderStatus.PROCESSING
      ) {
        await this.inventory.releaseForOrder(orderId, tx);
      }
    });
  }

  /** ----- Get order with webhook events (DB) ----- **/
  queryOrderWithEvents(params: {
    id: string;
    eventsCursor: string | null;
    eventsTake: number;
    eventsDirection: 'asc' | 'desc';
  }) {
    // Fetch single order including filtered webhook events list
    return this.prisma.order.findUnique({
      where: { id: params.id },
      include: {
        lineItems: true,
        webhookEvents: {
          // Apply cursor-based pagination on webhookEvents for this order
          cursor: params.eventsCursor ? { id: params.eventsCursor } : undefined,
          skip: params.eventsCursor ? 1 : 0,
          orderBy: [
            { createdAt: params.eventsDirection },
            { id: params.eventsDirection },
          ],
          take: params.eventsTake,
        },
      },
    });
  }

  /** ----- List orders with cursor pagination (DB) ----- **/
  queryOrders(params: {
    cursor: string | null;
    take: number;
    direction: 'asc' | 'desc';
  }) {
    // Return paginated list of orders using cursor-based pagination
    return this.prisma.order.findMany({
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: [{ createdAt: params.direction }, { id: params.direction }],
      take: params.take,
    });
  }

}
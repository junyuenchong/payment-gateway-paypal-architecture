import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { CreateOrderLineItem } from './application/commands/create-order.command';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';

import { AppConfigService } from '../../config';
import {
  logErrorNormalized,
  logErrorAndThrow,
  logWarnNormalized,
} from '../common/error.util';
import { RedisLockService } from '../locks/redis-lock.service';
import { QueueService } from '../queue/queue.service';
import {
  CaptureCheckoutOrderCommand,
  type CaptureCheckoutOrderResult,
} from '../payment/application/commands/payment-gateway.command';
import { OrderStatus, type OrderStatusCode } from './order.constant';
import { OrderRepository } from './order.repository';
import {
  buildOrderEventsPage,
  buildOrderListPage,
  isAlreadyCapturedError,
} from './order.helper';

/** ----- Handle order business service. ----- **/
@Injectable()
export class OrderService implements OnModuleInit {
  private readonly log = new Logger(OrderService.name);

  constructor(
    private readonly repository: OrderRepository,
    private readonly queue: QueueService,
    private readonly cfg: AppConfigService,
    private readonly redisLock: RedisLockService,
    private readonly commandBus: CommandBus,
  ) {}

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
    const order = await this.repository.createOrder({
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
          const locked = await this.repository.lockOrderForPaymentIntent({
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
          const order = await this.repository.findOrderById(orderId);
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
      const locked = await this.repository.lockOrderForCapture(orderId);

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
      await this.repository.updateCaptureStatusIfNeeded({
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
    const order = await this.repository.getOrderWithEvents({
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
    const orders = await this.repository.listOrders({
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
}

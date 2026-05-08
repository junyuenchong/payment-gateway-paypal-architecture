import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';

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
  normalizePositiveNumber,
} from './order.helper';

/** ----- Handle order business service. ----- **/
@Injectable()
export class OrderService implements OnModuleInit {
  private readonly log = new Logger(OrderService.name);

  constructor(
    private readonly repository: OrderRepository,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
    private readonly redisLock: RedisLockService,
    private readonly commandBus: CommandBus,
  ) {}

  /** ----- Initialize order module jobs ----- **/
  async onModuleInit(): Promise<void> {
    // Initialize and upsert expire orders sweep job on module init
    const normalizedEvery = normalizePositiveNumber(
      this.config.get('ORDER_EXPIRE_SWEEP_EVERY_MS') ?? 60000,
      60000,
    );

    await this.upsertExpireOrdersSweep(normalizedEvery).catch(
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

  /** ----- Create order record. ----- **/
  async createOrder(params: {
    amount: number;
    currency?: string;
    externalRef?: string;
  }): Promise<{ id: string; idempotencyKey: string }> {
    // Set currency, falling back to config or MYR default
    const currency = (
      params.currency ??
      this.config.get<string>('PAYPAL_CURRENCY') ??
      'MYR'
    ).toUpperCase();

    // Generate unique idempotency key for this order
    const idempotencyKey = `order_${randomUUID()}`;

    // Create order record in the database repository
    const order = await this.repository.createOrder({
      amount: params.amount,
      currency,
      externalRef: params.externalRef,
      idempotencyKey,
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
      const lock = await this.redisLock.tryAcquire(
        `lock:order:intent:${orderId}`,
        15000,
      );
      // If lock not acquired, another request is ongoing
      if (!lock) {
        throw new BadRequestException(
          'Payment intent request is already in progress. Please retry shortly.',
        );
      }

      try {
        // Determine if mock payment gateway is enabled
        const mockEnabled =
          this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';
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
      } finally {
        // Always release redis lock when finished
        await this.redisLock.release(lock);
      }
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
      const lock = await this.redisLock.tryAcquire(
        `lock:order:capture:${orderId}`,
        15000,
      );
      // If lock is not acquired, concurrent capture is ongoing
      if (!lock) {
        throw new BadRequestException(
          'Capture request is already in progress. Please retry shortly.',
        );
      }

      try {
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
      } finally {
        // Always release the lock after attempting scheduling
        await this.redisLock.release(lock);
      }
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

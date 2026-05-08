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
    const currency = (
      params.currency ??
      this.config.get<string>('PAYPAL_CURRENCY') ??
      'MYR'
    ).toUpperCase();
    const idempotencyKey = `order_${randomUUID()}`;

    const order = await this.repository.createOrder({
      amount: params.amount,
      currency,
      externalRef: params.externalRef,
      idempotencyKey,
    });

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
    try {
      const lock = await this.redisLock.tryAcquire(
        `lock:order:intent:${orderId}`,
        15000,
      );
      if (!lock) {
        throw new BadRequestException(
          'Payment intent request is already in progress. Please retry shortly.',
        );
      }

      try {
        const mockEnabled =
          this.config.get<string>('MOCK_PAYMENT_GATEWAY') === 'true';
        const provider: 'PAYPAL' | 'MOCK' = mockEnabled ? 'MOCK' : 'PAYPAL';

        const locked = await this.repository.lockOrderForPaymentIntent({
          orderId,
          mockEnabled,
        });

        if (locked.shouldEnqueue) {
          await this.queue.createPaymentIntent(locked.orderId);
        }

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
        await this.redisLock.release(lock);
      }
    } catch (error: unknown) {
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
    try {
      const lock = await this.redisLock.tryAcquire(
        `lock:order:capture:${orderId}`,
        15000,
      );
      if (!lock) {
        throw new BadRequestException(
          'Capture request is already in progress. Please retry shortly.',
        );
      }

      try {
        const order = await this.repository.findOrderById(orderId);
        if (!order) throw new NotFoundException('Order not found');
        if (!order.paypalOrderId) {
          throw new BadRequestException('Order has no PayPal order id');
        }

        if (order.status === OrderStatus.PAID) {
          return {
            orderId: order.id,
            status: OrderStatus.PAID as OrderStatusCode,
            paypalOrderId: order.paypalOrderId,
            message: 'Order already paid.',
          };
        }

        if (
          order.status !== OrderStatus.PROCESSING &&
          order.status !== OrderStatus.FAILED
        ) {
          throw new BadRequestException(
            `Order must be FAILED or PROCESSING to capture (got: ${order.status})`,
          );
        }

        try {
          await this.queue.capturePayment(order.id);
        } catch (error: unknown) {
          logWarnNormalized(
            this.log,
            error,
            'Schedule capture failed',
            `Capture job may already exist: ${order.id}`,
          );
        }

        return {
          orderId: order.id,
          status: OrderStatus.PROCESSING as OrderStatusCode,
          paypalOrderId: order.paypalOrderId,
          message: 'Capture scheduled.',
        };
      } finally {
        await this.redisLock.release(lock);
      }
    } catch (error: unknown) {
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
    try {
      const locked = await this.repository.lockOrderForCapture(orderId);

      if (!locked.shouldCapture) {
        return {
          orderId: locked.orderId,
          status: locked.status,
          paypalOrderId: locked.paypalOrderId,
          message: locked.message,
        };
      }

      let nextStatus: typeof OrderStatus.PAID | typeof OrderStatus.FAILED;
      let captureSucceeded = false;
      try {
        const captured = await this.commandBus.execute<
          CaptureCheckoutOrderCommand,
          CaptureCheckoutOrderResult
        >(new CaptureCheckoutOrderCommand(locked.paypalOrderId));
        captureSucceeded = captured.success;
        nextStatus = captured.success ? OrderStatus.PAID : OrderStatus.FAILED;
      } catch (error) {
        if (!isAlreadyCapturedError(error)) throw error;
        nextStatus = OrderStatus.PAID;
        captureSucceeded = true;
      }

      await this.repository.updateCaptureStatusIfNeeded({
        orderId,
        nextStatus,
      });

      return {
        orderId: locked.orderId,
        status: nextStatus as OrderStatusCode,
        paypalOrderId: locked.paypalOrderId,
        message: captureSucceeded
          ? 'Payment captured successfully.'
          : 'Payment capture failed.',
      };
    } catch (error: unknown) {
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
    const eventsTake = params.eventsLimit + 1;
    const order = await this.repository.getOrderWithEvents({
      id: params.id,
      eventsCursor: params.eventsCursor,
      eventsTake: eventsTake,
      eventsDirection: params.eventsDirection,
    });

    if (!order) throw new NotFoundException('Order not found');

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
    const take = params.limit + 1;
    const orders = await this.repository.listOrders({
      cursor: params.cursor,
      take,
      direction: params.direction,
    });

    return buildOrderListPage({
      orders,
      limit: params.limit,
      direction: params.direction,
    });
  }

  /** ----- Upsert expire orders sweep schedule ----- **/
  async upsertExpireOrdersSweep(everyMs: number): Promise<void> {
    await this.queue.upsertExpireOrdersSweep(everyMs);
  }
}

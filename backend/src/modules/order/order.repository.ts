import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { OrderStatus, type OrderStatusCode } from './order.constant';
import { PrismaService } from '../prisma/prisma.service';

/** ----- Handle order database access. ----- **/
@Injectable()
export class OrderRepository {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly prisma: PrismaService) {}

  /** ----- Create order record ----- **/
  createOrder(params: {
    amount: number;
    currency: string;
    externalRef?: string;
    idempotencyKey: string;
  }) {
    return this.prisma.order.create({
      data: {
        amount: new Prisma.Decimal(params.amount),
        currency: params.currency,
        externalRef: params.externalRef,
        idempotencyKey: params.idempotencyKey,
        status: OrderStatus.UNPAID,
      },
    });
  }

  /** ----- Lock order for payment intent ----- **/
  lockOrderForPaymentIntent(params: { orderId: string; mockEnabled: boolean }) {
    const { orderId, mockEnabled } = params;
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          currency: string;
          paypalOrderId: string | null;
          approvalUrl: string | null;
        }>
      >`
        SELECT
          id,
          status::text as status,
          currency,
          "paypalOrderId",
          "approvalUrl"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{
        id: string;
        status: string;
        currency: string;
        paypalOrderId: string | null;
        approvalUrl: string | null;
      }>;

      if (rows.length === 0) throw new NotFoundException('Order not found');

      const order = rows[0];
      const status = String(order.status);

      if (
        status === OrderStatus.PAID ||
        status === OrderStatus.REFUNDED ||
        status === OrderStatus.PARTIALLY_REFUNDED
      ) {
        return {
          orderId: order.id,
          status,
          paypalOrderId: order.paypalOrderId,
          approvalUrl: null,
          shouldEnqueue: false,
        } as const;
      }

      const checkoutReady =
        status === OrderStatus.PROCESSING &&
        !!order.paypalOrderId &&
        (mockEnabled || !!order.approvalUrl);

      if (checkoutReady) {
        return {
          orderId: order.id,
          status: OrderStatus.PROCESSING,
          paypalOrderId: order.paypalOrderId,
          approvalUrl: mockEnabled ? null : order.approvalUrl,
          shouldEnqueue: false,
        } as const;
      }

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

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING, approvalUrl: null },
      });

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
      const orderRows = (await tx.$queryRaw<
        Array<{ id: string; status: string; paypalOrderId: string | null }>
      >`
        SELECT id, status, "paypalOrderId"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{
        id: string;
        status: string;
        paypalOrderId: string | null;
      }>;

      if (orderRows.length === 0)
        throw new NotFoundException('Order not found');
      const order = orderRows[0];
      const status = order.status as OrderStatusCode;

      if (!order.paypalOrderId) {
        throw new BadRequestException('Order has no PayPal order id');
      }

      if (status === OrderStatus.PAID) {
        return {
          orderId: order.id,
          paypalOrderId: order.paypalOrderId,
          status: OrderStatus.PAID as OrderStatusCode,
          shouldCapture: false,
          message: 'Order already paid.',
        };
      }

      if (status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order cancelled; cannot capture');
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING },
      });

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
    const { orderId, nextStatus } = params;
    return this.prisma.$transaction(async (tx) => {
      const orderRows = (await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{ id: string; status: string }>;

      if (orderRows.length === 0) return;
      if (orderRows[0].status === OrderStatus.PAID) return;

      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });
    });
  }

  /** ----- Get order with webhook events ----- **/
  getOrderWithEvents(params: {
    id: string;
    eventsCursor: string | null;
    eventsTake: number;
    eventsDirection: 'asc' | 'desc';
  }) {
    return this.prisma.order.findUnique({
      where: { id: params.id },
      include: {
        webhookEvents: {
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

  /** ----- List orders with cursor pagination ----- **/
  listOrders(params: {
    cursor: string | null;
    take: number;
    direction: 'asc' | 'desc';
  }) {
    return this.prisma.order.findMany({
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: [{ createdAt: params.direction }, { id: params.direction }],
      take: params.take,
    });
  }
}

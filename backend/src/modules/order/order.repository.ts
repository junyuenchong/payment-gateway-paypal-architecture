import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus, type OrderStatusCode } from './order.constant';
import { PrismaService } from '../../database/prisma/prisma.service';

type CreateOrderLineItem = {
  sku: string;
  quantity: number;
  unitPrice: number;
};

/** ----- Handle order database access. ----- **/
@Injectable()
export class OrderRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /** ----- Create order record ----- **/
  createOrder(params: {
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
      // Raw SQL query to select and lock the order for update.
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

      // If the order does not exist, throw 404.
      if (rows.length === 0) throw new NotFoundException('Order not found');

      // Retrieve the only locked order row.
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
      // Start a transaction to lock the order row for update (avoids race conditions)
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

      // If we found no order row, throw not found
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
      // Select order row for update to ensure up-to-date status
      const orderRows = (await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{ id: string; status: string }>;

      // Return early if order not found in database
      if (orderRows.length === 0) return;
      // Do nothing if order's status is already PAID
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

  /** ----- Get order with webhook events ----- **/
  getOrderWithEvents(params: {
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

  /** ----- List orders with cursor pagination ----- **/
  listOrders(params: {
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

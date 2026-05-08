import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../order/order.constant';

/** ----- Handle queue database access. ----- **/
@Injectable()
export class QueueRepository {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly prisma: PrismaService) {}

  /** ----- Lock order for payment intent ----- **/
  lockOrderForPaymentIntent(orderId: string, mockEnabled: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          currency: string;
          paypalOrderId: string | null;
          approvalUrl: string | null;
          amount: string;
        }>
      >`
        SELECT id, status::text as status, currency, "paypalOrderId", "approvalUrl", amount::text as amount
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{
        id: string;
        status: string;
        currency: string;
        paypalOrderId: string | null;
        approvalUrl: string | null;
        amount: string;
      }>;

      if (rows.length === 0) return null;
      const order = rows[0];

      if (order.status === OrderStatus.PAID) {
        return { ...order, shouldWork: false };
      }

      const alreadyCreated =
        !!order.paypalOrderId && (mockEnabled || !!order.approvalUrl);
      if (alreadyCreated) {
        return { ...order, shouldWork: false };
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PROCESSING },
      });

      return { ...order, shouldWork: true };
    });
  }

  /** ----- Save mock gateway order data ----- **/
  saveMockGatewayOrder(orderId: string, paypalOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{
          id: string;
          approvalUrl: string | null;
          paypalOrderId: string | null;
        }>
      >`
        SELECT id, "approvalUrl", "paypalOrderId"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{
        id: string;
        approvalUrl: string | null;
        paypalOrderId: string | null;
      }>;

      if (rows.length === 0) return;
      const current = rows[0];
      if (current.paypalOrderId) return;

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PROCESSING,
          paypalOrderId,
          approvalUrl: null,
        },
      });
    });
  }

  /** ----- Save gateway order result data ----- **/
  saveGatewayOrderResult(params: {
    orderId: string;
    paypalOrderId: string;
    approvalUrl: string;
  }) {
    const { orderId, paypalOrderId, approvalUrl } = params;
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{ id: string; approvalUrl: string | null }>
      >`
        SELECT id, "approvalUrl"
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{ id: string; approvalUrl: string | null }>;

      if (rows.length === 0) return;
      if (rows[0].approvalUrl) return;

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PROCESSING,
          paypalOrderId,
          approvalUrl,
        },
      });
    });
  }

  /** ----- Expire stale processing orders ----- **/
  expireProcessingOrders(cutoff: Date) {
    return this.prisma.order.updateMany({
      where: {
        status: OrderStatus.PROCESSING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: OrderStatus.EXPIRED,
        paypalOrderId: null,
        approvalUrl: null,
      },
    });
  }
}

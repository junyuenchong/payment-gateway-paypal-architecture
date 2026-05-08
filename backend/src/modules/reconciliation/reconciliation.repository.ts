import { Injectable } from '@nestjs/common';

import { OrderStatus, type OrderStatusCode } from '../order/order.constant';
import { PrismaService } from '../prisma/prisma.service';

/** ----- Handle reconciliation database access. ----- **/
@Injectable()
export class ReconciliationRepository {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly prisma: PrismaService) {}

  findProcessingCandidates(params: { cutoff: Date; take: number }) {
    const { cutoff, take } = params;
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.PROCESSING,
        paypalOrderId: { not: null },
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take,
    });
  }

  updateProcessingOrderIfNeeded(params: {
    orderId: string;
    next: OrderStatusCode;
  }) {
    const { orderId, next } = params;
    return this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status::text as status
        FROM "Order"
        WHERE id = ${orderId}
        FOR UPDATE
      `) as Array<{ id: string; status: string }>;

      if (rows.length === 0) return false;
      if (rows[0].status !== OrderStatus.PROCESSING) return false;

      await tx.order.update({
        where: { id: orderId },
        data: { status: next },
      });

      return true;
    });
  }
}

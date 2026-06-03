import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '../../common/config';
import { InventoryService } from '../../modules/inventory/inventory.service';
import { OrderStatus, type OrderStatusCode } from '../../modules/order/enums/order-status.enum';
import { PaymentService } from '../../modules/payment/payment.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { RowLockService } from '../../infrastructure/database/prisma/locks/row-lock.service';
import { PrismaTransactionService } from '../../infrastructure/database/prisma/prisma-transaction.service';
import { toError, toErrorMessage } from '../../common/shared/helpers/error.util';
import { QueueService } from '../queue/queue.service';
import {
  normalizeGatewayStatus,
  type PayPalOrderStatus,
} from './helpers/reconciliation.helper';
import type {
  FindProcessingCandidatesParams,
  UpdateProcessingOrderIfNeededParams,
} from './dto/reconciliation.dto';

/** ----- Reconcile local orders against payment gateway status. ----- **/
@Injectable()
export class ReconciliationService implements OnModuleInit {
  private readonly log = new Logger(ReconciliationService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLocks: RowLockService,
    private readonly transactions: PrismaTransactionService,
    private readonly inventory: InventoryService,
    private readonly cfg: AppConfigService,
    private readonly payment: PaymentService,
    private readonly queue: QueueService,
  ) {}

  /** ----- Register recurring reconciliation sweep on module init. ----- **/
  async onModuleInit(): Promise<void> {
    // Schedule repeat job to fix stuck PROCESSING orders vs gateway truth
    await this.queue
      .upsertReconcileOrdersSweep(this.cfg.reconciliation.everyMs)
      .catch((err: unknown) => {
        const normalized = toError(err, 'Upsert reconciliation sweep failed');
        this.log.error('Failed to upsert reconciliation sweep job');
        this.log.error(normalized.stack ?? normalized.message);
      });
  }

  /** ----- Sweep PROCESSING orders and align status with gateway. ----- **/
  async reconcileOrdersSweep(): Promise<void> {
    const cutoff = new Date(Date.now() - this.cfg.reconciliation.lookbackMs);

    // Load stale candidates in bounded batch
    const candidates = await this.findProcessingCandidates({
      cutoff,
      take: this.cfg.reconciliation.batchSize,
    });

    if (candidates.length === 0) return;

    let fixed = 0;
    let failed = 0;

    for (const c of candidates) {
      const paypalOrderId = c.paypalOrderId ?? '';
      if (!paypalOrderId) continue;

      // Ask gateway for authoritative checkout status
      let gatewayStatus: PayPalOrderStatus = 'UNKNOWN';
      try {
        const statusResult =
          await this.payment.getCheckoutOrderStatus(paypalOrderId);
        gatewayStatus = normalizeGatewayStatus(statusResult.status);
      } catch (e) {
        failed += 1;
        const msg = toErrorMessage(e, 'Gateway lookup failed');
        this.log.warn(
          `Reconciliation gateway lookup failed for order ${c.id}: ${msg}`,
        );
        continue;
      }

      // Map gateway status to local terminal transition when safe
      let next: OrderStatusCode | null = null;
      if (gatewayStatus === 'COMPLETED') next = OrderStatus.PAID;
      if (gatewayStatus === 'VOIDED') next = OrderStatus.CANCELLED;
      if (!next) continue;

      const updated = await this.updateProcessingOrderIfNeeded({
        orderId: c.id,
        next,
      });

      if (updated) fixed += 1;
    }

    if (fixed > 0 || failed > 0) {
      this.log.log(
        `Reconciliation sweep finished. fixed=${fixed} failed=${failed} scanned=${candidates.length}`,
      );
    }
  }

  /** ----- Find PROCESSING orders eligible for reconciliation. ----- **/
  findProcessingCandidates(params: FindProcessingCandidatesParams) {
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

  /** ----- Update order + inventory when gateway disagrees with PROCESSING. ----- **/
  updateProcessingOrderIfNeeded(params: UpdateProcessingOrderIfNeededParams) {
    const { orderId, next } = params;
    return this.transactions.run(async (tx) => {
      const rows = await this.rowLocks.findOrderIdAndStatus(tx, orderId);

      if (rows.length === 0) return false;
      if (rows[0].status !== OrderStatus.PROCESSING) return false;

      // Settle inventory before persisting new order status
      if (next === OrderStatus.PAID) {
        await this.inventory.commitForOrder(orderId, tx);
      } else if (next === OrderStatus.CANCELLED) {
        await this.inventory.releaseForOrder(orderId, tx);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: next },
      });

      return true;
    });
  }
}

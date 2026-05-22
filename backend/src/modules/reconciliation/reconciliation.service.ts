import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config';
import { toErrorMessage } from '../../shared/helpers/error.util';
import { OrderStatus, type OrderStatusCode } from '../order/order.constant';
import { PaymentService } from '../payment/payment.service';
import { ReconciliationRepository } from './reconciliation.repository';
import {
  normalizeGatewayStatus,
  type PayPalOrderStatus,
} from './reconciliation.helper';
/** ----- Handle reconciliatio ervice class ----- **/
@Injectable()
export class ReconciliationService {
  private readonly log = new Logger(ReconciliationService.name);

  constructor(
    private readonly cfg: AppConfigService,
    private readonly repository: ReconciliationRepository,
    private readonly payment: PaymentService,
  ) {}

  /** ----- Reconcile PROCESSING orders with gateway status. ----- **/
  async reconcileOrdersSweep(): Promise<void> {
    const cutoff = new Date(Date.now() - this.cfg.reconciliation.lookbackMs);

    const candidates = await this.repository.findProcessingCandidates({
      cutoff,
      take: this.cfg.reconciliation.batchSize,
    });

    if (candidates.length === 0) return;

    let fixed = 0;
    let failed = 0;

    for (const c of candidates) {
      const paypalOrderId = c.paypalOrderId ?? '';
      if (!paypalOrderId) continue;

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

      let next: OrderStatusCode | null = null;
      if (gatewayStatus === 'COMPLETED') next = OrderStatus.PAID;
      if (gatewayStatus === 'VOIDED') next = OrderStatus.CANCELLED;
      if (!next) continue;

      const updated = await this.repository.updateProcessingOrderIfNeeded({
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
}

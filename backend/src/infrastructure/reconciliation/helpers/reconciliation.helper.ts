import type { PayPalOrderStatus } from '../dto/reconciliation.dto';

export type { PayPalOrderStatus };

/** ----- Normalize gateway status string. ----- **/
export function normalizeGatewayStatus(status: string): PayPalOrderStatus {
  const s = String(status ?? '').toUpperCase();
  switch (s) {
    case 'CREATED':
    case 'SAVED':
    case 'APPROVED':
    case 'VOIDED':
    case 'COMPLETED':
    case 'PAYER_ACTION_REQUIRED':
      return s;
    default:
      return 'UNKNOWN';
  }
}

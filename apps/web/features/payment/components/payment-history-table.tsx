import { ActionButton } from './ui/action-button';
import type { PaymentRow } from '../hooks/use-orders-history';
import {
  uiTokens,
  defaultStatusTone,
  statusToneByCode,
} from '../../shared/lib/ui-tokens';

/**
 * ------------------------------------------------------
 * Format Marketplace Status Label
 * ------------------------------------------------------
 */
function formatMarketplaceStatus(raw: string): string {
  switch (raw) {
    case 'UNPAID':
      return 'To Pay';
    case 'PROCESSING':
      return 'Processing';
    case 'EXPIRED':
      return 'Expired';
    case 'PAID':
      return 'Paid';
    case 'FAILED':
      return 'Failed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'REFUNDING':
      return 'Refunding';
    case 'PARTIALLY_REFUNDED':
      return 'Partially Refunded';
    case 'REFUNDED':
      return 'Refunded';
    default:
      return raw;
  }
}

/**
 * ------------------------------------------------------
 * Resolve Status Tone Class
 * ------------------------------------------------------
 */
function statusTone(raw: string): string {
  return statusToneByCode[raw] ?? defaultStatusTone;
}

/**
 * ------------------------------------------------------
 * Payment History Table Props
 * ------------------------------------------------------
 */
type PaymentHistoryTableProps = {
  rows: PaymentRow[];
  hasMoreOrders: boolean;
  loadingMoreOrders: boolean;
  onLoadMore: () => void;
  onPayAgain: (orderId: string) => void;
  payingOrderId?: string | null;
};

/**
 * ------------------------------------------------------
 * Payment History Table
 * ------------------------------------------------------
 */
export function PaymentHistoryTable({
  rows,
  hasMoreOrders,
  loadingMoreOrders,
  onLoadMore,
  onPayAgain,
  payingOrderId,
}: PaymentHistoryTableProps) {
  return (
    <>
      <div className={uiTokens.tableContainer}>
        <div className="overflow-x-auto">
          <table className={`${uiTokens.tableText} md:min-w-[980px]`}>
            <thead className="hidden bg-slate-800/80 text-slate-300 md:table-header-group">
              <tr>
                <th className="px-3 py-2">Order ID</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Intent Status</th>
                <th className="px-3 py-2">Live Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 md:sticky md:right-0 md:z-10 md:w-[180px] md:bg-slate-800/90">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {rows.length === 0 ? (
                <tr className="block md:table-row">
                  <td
                    className="block px-3 py-3 text-slate-400 md:table-cell"
                    colSpan={8}
                  >
                    No payment records yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.orderId} className={uiTokens.tableMobileRow}>
                    <td className="block px-1 py-1 md:table-cell md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Order ID:
                      </span>
                      {row.orderId}
                    </td>
                    <td className="block px-1 py-1 md:table-cell md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Provider:
                      </span>
                      {row.provider}
                    </td>
                    <td className="block px-1 py-1 md:table-cell md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Amount:
                      </span>
                      {row.amount.toFixed(2)}
                    </td>
                    <td className="block px-1 py-1 md:table-cell md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Currency:
                      </span>
                      {row.currency}
                    </td>
                    <td className="block px-1 py-1 md:table-cell md:min-w-[150px] md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Intent:
                      </span>
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-base ${statusTone(row.intentStatus)}`}
                      >
                        {formatMarketplaceStatus(row.intentStatus)}
                      </span>
                    </td>
                    <td className="block px-1 py-1 md:table-cell md:min-w-[150px] md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Live:
                      </span>
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-base ${statusTone(row.liveStatus)}`}
                      >
                        {formatMarketplaceStatus(row.liveStatus)}
                      </span>
                    </td>
                    <td className="block px-1 py-1 md:table-cell md:px-3 md:py-2">
                      <span className="mr-2 text-slate-400 md:hidden">
                        Updated:
                      </span>
                      {row.updatedAt}
                    </td>
                    <td className="block px-1 py-2 md:sticky md:right-0 md:z-10 md:w-[180px] md:table-cell md:bg-slate-900/90 md:px-3 md:py-2">
                      {row.liveStatus === 'PAID' ||
                      row.liveStatus === 'REFUNDED' ||
                      row.liveStatus === 'PARTIALLY_REFUNDED' ? (
                        <span className="text-slate-500">-</span>
                      ) : (
                        <ActionButton
                          onClick={() => onPayAgain(row.orderId)}
                          disabled={payingOrderId === row.orderId}
                          className="h-10 px-4 text-base sm:text-base"
                        >
                          {payingOrderId === row.orderId
                            ? 'Opening...'
                            : 'Pay Again'}
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {hasMoreOrders ? (
        <div className="mt-3">
          <ActionButton onClick={onLoadMore} disabled={loadingMoreOrders}>
            {loadingMoreOrders ? 'Loading more...' : 'Load More Orders'}
          </ActionButton>
        </div>
      ) : null}
    </>
  );
}

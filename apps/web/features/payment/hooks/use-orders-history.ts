import { useEffect, useState } from 'react';
import { getOrders } from '../services/payment.service';
import type { OrderListItemResponse } from '../types';
import { toErrorMessage } from '../../shared/lib/error';

/**
 * ------------------------------------------------------
 * Orders History Pagination Defaults
 * ------------------------------------------------------
 */
const ORDER_PAGE_SIZE = 20;

/**
 * ------------------------------------------------------
 * Payment Table Row View Model
 * ------------------------------------------------------
 */
export type PaymentRow = {
  orderId: string;
  provider: string;
  currency: string;
  amount: number;
  intentStatus: string;
  liveStatus: string;
  updatedAt: string;
};

/**
 * ------------------------------------------------------
 * Map Order DTO To Payment Row
 * ------------------------------------------------------
 */
function mapOrderToRow(order: OrderListItemResponse): PaymentRow {
  return {
    orderId: order.id,
    provider: order.paypalOrderId ? 'PAYPAL' : '-',
    currency: order.currency,
    amount: Number(order.amount),
    intentStatus: order.status,
    liveStatus: order.status,
    updatedAt: new Date(order.updatedAt).toLocaleTimeString(),
  };
}

/**
 * ------------------------------------------------------
 * Use Orders History Hook
 * ------------------------------------------------------
 */
export function useOrdersHistory() {
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [ordersNextCursor, setOrdersNextCursor] = useState<string | null>(null);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | undefined>();

  useEffect(() => {
    void getOrders({ limit: ORDER_PAGE_SIZE, direction: 'desc' })
      .then((response) => {
        setPaymentRows(response.data.map((order) => mapOrderToRow(order)));
        setOrdersNextCursor(response.pageInfo.nextCursor);
        setHasMoreOrders(response.pageInfo.hasMore);
        setOrdersError(undefined);
      })
      .catch((err) => {
        setOrdersError(toErrorMessage(err, 'Unable to load order history.'));
      });
  }, []);

  /**
   * ------------------------------------------------------
   * Load More Orders Page
   * ------------------------------------------------------
   */
  const loadMoreOrders = async () => {
    if (!ordersNextCursor || loadingMoreOrders || !hasMoreOrders) return;

    setLoadingMoreOrders(true);
    setOrdersError(undefined);
    try {
      const response = await getOrders({
        cursor: ordersNextCursor,
        limit: ORDER_PAGE_SIZE,
        direction: 'desc',
      });
      setPaymentRows((prev) => {
        const existingIds = new Set(prev.map((row) => row.orderId));
        const nextRows = response.data
          .map((order) => mapOrderToRow(order))
          .filter((row) => !existingIds.has(row.orderId));
        return [...prev, ...nextRows];
      });
      setOrdersNextCursor(response.pageInfo.nextCursor);
      setHasMoreOrders(response.pageInfo.hasMore);
    } catch (err) {
      setOrdersError(toErrorMessage(err, 'Unable to load more orders.'));
    } finally {
      setLoadingMoreOrders(false);
    }
  };

  return {
    paymentRows,
    setPaymentRows,
    hasMoreOrders,
    loadingMoreOrders,
    ordersError,
    loadMoreOrders,
  };
}

import type {
  CapturePaymentResponse,
  OrderListResponse,
  OrderStatusResponse,
  PaymentIntentResponse,
} from '../types';
import { apiRequest } from '../../shared/services/api-client';
import {
  CapturePaymentResponseSchema,
  CreateOrderResponseSchema,
  OrderListResponseSchema,
  OrderStatusResponseSchema,
  PaymentIntentResponseSchema,
} from '../schemas';

/**
 * ------------------------------------------------------
 * Create Order Response Type
 * ------------------------------------------------------
 */
type CreateOrderResponse = {
  id: string;
  idempotencyKey: string;
};

/**
 * ------------------------------------------------------
 * Create Order
 * ------------------------------------------------------
 */
export function createOrder(payload: {
  amount: number;
  currency: string;
  externalRef?: string;
}) {
  return apiRequest<CreateOrderResponse>(
    '/orders',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    CreateOrderResponseSchema,
  );
}

/**
 * ------------------------------------------------------
 * Create Payment Intent
 * ------------------------------------------------------
 */
export function createPaymentIntent(orderId: string) {
  return apiRequest<PaymentIntentResponse>(
    `/orders/${orderId}/payment-intent`,
    { method: 'POST' },
    PaymentIntentResponseSchema,
  );
}

/**
 * ------------------------------------------------------
 * Capture Payment
 * ------------------------------------------------------
 */
export function capturePayment(orderId: string) {
  return apiRequest<CapturePaymentResponse>(
    `/orders/${orderId}/capture`,
    {
      method: 'POST',
    },
    CapturePaymentResponseSchema,
  );
}

/**
 * ------------------------------------------------------
 * Get Order Status
 * ------------------------------------------------------
 */
export function getOrderStatus(orderId: string) {
  return apiRequest<OrderStatusResponse>(
    `/orders/${orderId}`,
    undefined,
    OrderStatusResponseSchema,
  );
}

/**
 * ------------------------------------------------------
 * Get Orders List
 * ------------------------------------------------------
 */
export function getOrders(params?: {
  cursor?: string;
  limit?: number;
  direction?: 'asc' | 'desc';
}): Promise<OrderListResponse> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.direction) query.set('direction', params.direction);
  const path = query.size > 0 ? `/orders?${query.toString()}` : '/orders';

  return apiRequest<OrderListResponse>(
    path,
    undefined,
    OrderListResponseSchema,
  );
}

import { z } from 'zod';

/**
 * ------------------------------------------------------
 * Create Order Response Schema
 * ------------------------------------------------------
 */
export const CreateOrderResponseSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
});

/**
 * ------------------------------------------------------
 * Payment Intent Response Schema
 * ------------------------------------------------------
 */
export const PaymentIntentResponseSchema = z.object({
  orderId: z.string(),
  provider: z.union([z.literal('PAYPAL'), z.literal('MOCK')]),
  approvalUrl: z.string().nullable(),
  status: z.string(),
});

/**
 * ------------------------------------------------------
 * Capture Payment Response Schema
 * ------------------------------------------------------
 */
export const CapturePaymentResponseSchema = z.object({
  orderId: z.string(),
  status: z.union([
    z.literal('PAID'),
    z.literal('FAILED'),
    z.literal('PROCESSING'),
  ]),
  paypalOrderId: z.string(),
  message: z.string(),
});

/**
 * ------------------------------------------------------
 * Order Status Response Schema
 * ------------------------------------------------------
 */
export const OrderStatusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  paypalOrderId: z.string().nullable().optional(),
  approvalUrl: z.string().nullable().optional(),
});

/**
 * ------------------------------------------------------
 * Order List Item Response Schema
 * ------------------------------------------------------
 */
export const OrderListItemResponseSchema = z.object({
  id: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: z.string(),
  paypalOrderId: z.string().nullable().optional(),
  updatedAt: z.string(),
});

/**
 * ------------------------------------------------------
 * Order List Response Schema
 * ------------------------------------------------------
 */
export const OrderListResponseSchema = z.object({
  data: z.array(OrderListItemResponseSchema),
  pageInfo: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    limit: z.number().int(),
    direction: z.union([z.literal('asc'), z.literal('desc')]),
  }),
});

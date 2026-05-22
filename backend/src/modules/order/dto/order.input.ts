import { z } from 'zod';

const OrderLineItemInputSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0.01),
});

/** ----- Orders - Input Schemas ----- **/
export const CreateOrderInputSchema = z.object({
  amount: z.number().min(0.01),
  currency: z.string().length(3).optional(),
  externalRef: z.string().optional(),
  items: z.array(OrderLineItemInputSchema).min(1).optional(),
});

export const OrderIdParamInputSchema = z.object({
  id: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
export type OrderIdParamInput = z.infer<typeof OrderIdParamInputSchema>;

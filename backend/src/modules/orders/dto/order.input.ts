import { z } from 'zod';

/**
 * ------------------------------------------------------
 * Orders - Input Schemas
 * ------------------------------------------------------
 */
export const CreateOrderInputSchema = z.object({
  amount: z.number().min(0.01),
  currency: z.string().length(3).optional(),
  externalRef: z.string().optional(),
});

export const OrderIdParamInputSchema = z.object({
  id: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
export type OrderIdParamInput = z.infer<typeof OrderIdParamInputSchema>;

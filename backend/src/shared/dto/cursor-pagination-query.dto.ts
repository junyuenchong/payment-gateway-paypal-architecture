import { z } from 'zod';

export const CursorDirectionSchema = z.enum(['asc', 'desc']);

export const CursorPaginationQueryDtoSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: CursorDirectionSchema.default('desc'),
});

export type CursorDirection = z.infer<typeof CursorDirectionSchema>;
export type CursorPaginationQueryDto = z.infer<
  typeof CursorPaginationQueryDtoSchema
>;

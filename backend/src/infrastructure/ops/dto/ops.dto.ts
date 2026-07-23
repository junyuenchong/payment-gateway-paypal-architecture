import { z } from 'zod';

export const ListDlqQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  queue: z.string().min(1).optional(),
});

export type ListDlqQuery = z.infer<typeof ListDlqQuerySchema>;

export const ReplayDlqParamSchema = z.object({
  jobId: z.string().min(1),
});

export type ReplayDlqParam = z.infer<typeof ReplayDlqParamSchema>;

export const ReplayDlqQuerySchema = z.object({
  queue: z.string().min(1),
});

export type ReplayDlqQuery = z.infer<typeof ReplayDlqQuerySchema>;

export type DlqJobDto = {
  id: string;
  queue: string;
  name: string;
  attemptsMade: number;
  failedReason: string | null;
  timestamp: number | null;
  data: unknown;
};

export type QueueMetricsDto = {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
};

export type OpsMetricsDto = {
  queues: QueueMetricsDto[];
};

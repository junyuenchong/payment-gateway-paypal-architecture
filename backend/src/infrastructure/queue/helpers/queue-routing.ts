import type { Queue } from 'bullmq';

import {
  AUDIT_QUEUE,
  EMAIL_QUEUE,
  NOTIFICATION_QUEUE,
} from '../enums/bullmq-queue.enum';
import { JOBS, type JobName } from '../enums/queue-job.enum';

const EMAIL_JOBS = new Set<JobName>([
  JOBS.CREATE_PAYMENT_INTENT,
  JOBS.CAPTURE_PAYMENT,
  JOBS.MOCK_CAPTURE_SUCCESS,
]);

const AUDIT_JOBS = new Set<JobName>([JOBS.PROCESS_WEBHOOK]);

const NOTIFICATION_JOBS = new Set<JobName>([
  JOBS.EXPIRE_ORDERS_SWEEP,
  JOBS.EXPIRE_RESERVATIONS_SWEEP,
  JOBS.EXPIRE_UNPAID_ORDERS_SWEEP,
  JOBS.RECONCILE_ORDERS_SWEEP,
]);

/** ----- Resolve BullMQ queue instance for a job name. ----- **/
export function queueForJob(
  name: JobName,
  queues: Record<string, Queue>,
): Queue {
  if (EMAIL_JOBS.has(name)) return queues[EMAIL_QUEUE];
  if (AUDIT_JOBS.has(name)) return queues[AUDIT_QUEUE];
  if (NOTIFICATION_JOBS.has(name)) return queues[NOTIFICATION_QUEUE];
  throw new Error(`No queue registered for job: ${name}`);
}

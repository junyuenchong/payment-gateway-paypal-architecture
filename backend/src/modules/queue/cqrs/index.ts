import { CapturePaymentJobHandler } from '../application/handlers/capture-payment-job.handler';
import { CreatePaymentIntentJobHandler } from '../application/handlers/create-payment-intent-job.handler';
import { ExpireOrdersSweepJobHandler } from '../application/handlers/expire-orders-sweep-job.handler';
import { MockCaptureSuccessJobHandler } from '../application/handlers/mock-capture-success-job.handler';
import { ProcessWebhookJobHandler } from '../application/handlers/process-webhook-job.handler';
import { ReconcileOrdersSweepJobHandler } from '../application/handlers/reconcile-orders-sweep-job.handler';

export const CommandHandlers = [
  CreatePaymentIntentJobHandler,
  CapturePaymentJobHandler,
  ProcessWebhookJobHandler,
  ExpireOrdersSweepJobHandler,
  ReconcileOrdersSweepJobHandler,
  MockCaptureSuccessJobHandler,
];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];

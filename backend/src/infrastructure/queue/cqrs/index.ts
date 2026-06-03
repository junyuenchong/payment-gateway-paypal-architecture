import {
  CapturePaymentJobHandler,
  CreatePaymentIntentJobHandler,
  ExpireOrdersSweepJobHandler,
  ExpireReservationsSweepJobHandler,
  ExpireUnpaidOrdersSweepJobHandler,
  MockCaptureSuccessJobHandler,
  ProcessWebhookJobHandler,
  ReconcileOrdersSweepJobHandler,
} from './handlers';

export const CommandHandlers = [
  CreatePaymentIntentJobHandler,
  CapturePaymentJobHandler,
  ProcessWebhookJobHandler,
  ExpireOrdersSweepJobHandler,
  ExpireReservationsSweepJobHandler,
  ExpireUnpaidOrdersSweepJobHandler,
  ReconcileOrdersSweepJobHandler,
  MockCaptureSuccessJobHandler,
];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];

import configuration from '../../common/config/configuration';

const queues = configuration().bullmq.queues;

/** Payment intent / capture jobs (checkout comms). */
export const EMAIL_QUEUE = queues.email;

/** Webhook event processing (payment audit trail). */
export const AUDIT_QUEUE = queues.audit;

/** Scheduled sweeps and reconciliation. */
export const NOTIFICATION_QUEUE = queues.notification;

export const ORDER_MAINTENANCE_QUEUE = 'order-maintenance' as const;

export const EXPIRE_ORDERS_SWEEP_JOB = 'expire-orders-sweep' as const;

export type ExpireOrdersSweepJobData = Record<string, never>;

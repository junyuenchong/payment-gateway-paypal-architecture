/** ----- Root application configuration shape (Nest ConfigService namespace). ----- **/
export type AppConfiguration = {
  app: {
    port: number;
    nodeEnv: string;
    projectName: string;
    baseUrl: string;
    frontendBaseUrl: string;
    corsOrigins: string[];
  };
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    prefix: string;
  };
  bullmq: {
    queues: {
      email: string;
      audit: string;
      notification: string;
    };
    jobAttempts: number;
    jobBackoffDelayMs: number;
    removeOnFail: number;
  };
  paypal: {
    apiBase: string;
    clientId: string;
    secretKey: string;
    webhookId?: string;
    currency: string;
    supportedCurrencies: string[];
  };
  mock: {
    paymentGateway: boolean;
    webhookSecret: string;
    captureDelayMs: number;
  };
  order: {
    processingExpireMs: number;
    expireSweepEveryMs: number;
  };
  inventory: {
    reservationTtlMs: number;
    reservationSweepEveryMs: number;
    unpaidOrderExpireMs: number;
    unpaidOrderSweepEveryMs: number;
  };
  reconciliation: {
    everyMs: number;
    batchSize: number;
    lookbackMs: number;
  };
  rateLimit: {
    ttlMs: number;
    limit: number;
    paymentTtlMs: number;
    paymentLimit: number;
    webhookTtlMs: number;
    webhookLimit: number;
  };
};

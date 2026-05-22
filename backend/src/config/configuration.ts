import type { AppConfiguration } from './config.types';
import {
  optionalString,
  parseBool,
  parsePositiveInt,
  requiredString,
} from './config.util';

/** ----- Load all environment variables into a typed config tree. ----- **/
export default (): AppConfiguration => {
  const nodeEnv = optionalString(process.env.NODE_ENV) ?? 'development';
  const mockEnabled = parseBool(process.env.MOCK_PAYMENT_GATEWAY, false);

  const paypalClientId =
    optionalString(process.env.PAYPAL_CLIENT_ID) ??
    (mockEnabled ? 'mock-client-id' : '');
  const paypalSecret =
    optionalString(process.env.PAYPAL_SECRET_KEY) ??
    (mockEnabled ? 'mock-secret-key' : '');
  const paypalApiBase =
    optionalString(process.env.PAYPAL_API_BASE) ??
    'https://api-m.sandbox.paypal.com';

  if (!mockEnabled) {
    requiredString(paypalClientId, 'PAYPAL_CLIENT_ID');
    requiredString(paypalSecret, 'PAYPAL_SECRET_KEY');
  }

  const supportedRaw =
    optionalString(process.env.PAYPAL_SUPPORTED_CURRENCIES) ?? 'MYR';

  return {
    app: {
      port: parsePositiveInt(process.env.PORT, 3000),
      nodeEnv,
      projectName: optionalString(process.env.PROJECT_NAME) ?? 'PaymentWebhook',
      baseUrl:
        optionalString(process.env.APP_BASE_URL) ?? 'http://127.0.0.1:3000',
      frontendBaseUrl:
        optionalString(process.env.FRONTEND_BASE_URL) ??
        'http://localhost:8080',
      corsOrigins: [
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        optionalString(process.env.FRONTEND_BASE_URL) ?? 'http://localhost:8080',
      ],
    },
    database: {
      url: requiredString(process.env.DATABASE_URL, 'DATABASE_URL'),
    },
    redis: {
      host: optionalString(process.env.BULLMQ_REDIS_HOST) ?? 'localhost',
      port: parsePositiveInt(process.env.BULLMQ_REDIS_PORT, 6379),
      password: optionalString(process.env.BULLMQ_REDIS_PASSWORD),
      prefix:
        optionalString(process.env.BULLMQ_PREFIX) ??
        `paymentwebhook-${nodeEnv}`,
    },
    bullmq: {
      queueName: optionalString(process.env.BULLMQ_QUEUE_NAME) ?? 'app-queue',
      jobAttempts: parsePositiveInt(process.env.BULLMQ_JOB_ATTEMPTS, 5),
      jobBackoffDelayMs: parsePositiveInt(
        process.env.BULLMQ_JOB_BACKOFF_DELAY_MS,
        1000,
      ),
      removeOnFail: parsePositiveInt(process.env.BULLMQ_REMOVE_ON_FAIL, 1000),
    },
    paypal: {
      apiBase: paypalApiBase,
      clientId: paypalClientId || 'mock-client-id',
      secretKey: paypalSecret || 'mock-secret-key',
      webhookId: optionalString(process.env.PAYPAL_WEBHOOK_ID),
      currency: (optionalString(process.env.PAYPAL_CURRENCY) ?? 'MYR').toUpperCase(),
      supportedCurrencies: supportedRaw
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length > 0),
    },
    mock: {
      paymentGateway: mockEnabled,
      webhookSecret:
        optionalString(process.env.MOCK_WEBHOOK_SECRET) ??
        'dev-mock-webhook-secret',
      captureDelayMs: parsePositiveInt(process.env.MOCK_CAPTURE_DELAY_MS, 2500),
    },
    order: {
      processingExpireMs: parsePositiveInt(
        process.env.ORDER_PROCESSING_EXPIRE_MS,
        900_000,
      ),
      expireSweepEveryMs: parsePositiveInt(
        process.env.ORDER_EXPIRE_SWEEP_EVERY_MS,
        60_000,
      ),
    },
    inventory: {
      reservationTtlMs: parsePositiveInt(
        process.env.STOCK_RESERVATION_TTL_MS,
        900_000,
      ),
      reservationSweepEveryMs: parsePositiveInt(
        process.env.STOCK_RESERVATION_SWEEP_EVERY_MS,
        30_000,
      ),
      unpaidOrderExpireMs: parsePositiveInt(
        process.env.UNPAID_ORDER_EXPIRE_MS,
        1_800_000,
      ),
      unpaidOrderSweepEveryMs: parsePositiveInt(
        process.env.UNPAID_ORDER_SWEEP_EVERY_MS,
        60_000,
      ),
    },
    reconciliation: {
      everyMs: parsePositiveInt(process.env.RECONCILIATION_EVERY_MS, 120_000),
      batchSize: parsePositiveInt(process.env.RECONCILIATION_BATCH_SIZE, 50),
      lookbackMs: parsePositiveInt(
        process.env.RECONCILIATION_LOOKBACK_MS,
        10 * 60 * 1000,
      ),
    },
  };
};

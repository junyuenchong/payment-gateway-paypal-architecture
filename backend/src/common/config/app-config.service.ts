import { Injectable } from '@nestjs/common';

import configuration from './configuration';
import type { AppConfiguration } from './config.types';

/** ----- Typed access to application configuration. ----- **/
@Injectable()
export class AppConfigService {
  readonly values: AppConfiguration;

  /** ----- Load configuration snapshot from environment. ----- **/
  constructor() {
    this.values = configuration();
  }

  /** ----- Application HTTP and CORS settings. ----- **/
  get app(): AppConfiguration['app'] {
    return this.values.app;
  }

  /** ----- Database connection settings. ----- **/
  get database(): AppConfiguration['database'] {
    return this.values.database;
  }

  /** ----- Redis connection settings. ----- **/
  get redis(): AppConfiguration['redis'] {
    return this.values.redis;
  }

  /** ----- BullMQ queue names and job defaults. ----- **/
  get bullmq(): AppConfiguration['bullmq'] {
    return this.values.bullmq;
  }

  /** ----- PayPal API credentials and currency. ----- **/
  get paypal(): AppConfiguration['paypal'] {
    return this.values.paypal;
  }

  /** ----- Mock gateway and webhook settings. ----- **/
  get mock(): AppConfiguration['mock'] {
    return this.values.mock;
  }

  /** ----- Order lifecycle TTLs and sweeps. ----- **/
  get order(): AppConfiguration['order'] {
    return this.values.order;
  }

  /** ----- Inventory reservation TTLs and sweeps. ----- **/
  get inventory(): AppConfiguration['inventory'] {
    return this.values.inventory;
  }

  /** ----- Reconciliation sweep settings. ----- **/
  get reconciliation(): AppConfiguration['reconciliation'] {
    return this.values.reconciliation;
  }

  /** ----- HTTP rate limit settings (IP or x-api-key). ----- **/
  get rateLimit(): AppConfiguration['rateLimit'] {
    return this.values.rateLimit;
  }

  /** ----- True when NODE_ENV is production. ----- **/
  get isProduction(): boolean {
    return this.app.nodeEnv === 'production';
  }

  /** ----- True when mock payment gateway is enabled. ----- **/
  get isMockPaymentGateway(): boolean {
    return this.mock.paymentGateway;
  }
}

import { Injectable } from '@nestjs/common';

import configuration from './configuration';
import type { AppConfiguration } from './config.types';

/** ----- Typed access to application configuration. ----- **/
@Injectable()
export class AppConfigService {
  readonly values: AppConfiguration;

  constructor() {
    this.values = configuration();
  }

  get app(): AppConfiguration['app'] {
    return this.values.app;
  }

  get database(): AppConfiguration['database'] {
    return this.values.database;
  }

  get redis(): AppConfiguration['redis'] {
    return this.values.redis;
  }

  get bullmq(): AppConfiguration['bullmq'] {
    return this.values.bullmq;
  }

  get paypal(): AppConfiguration['paypal'] {
    return this.values.paypal;
  }

  get mock(): AppConfiguration['mock'] {
    return this.values.mock;
  }

  get order(): AppConfiguration['order'] {
    return this.values.order;
  }

  get inventory(): AppConfiguration['inventory'] {
    return this.values.inventory;
  }

  get reconciliation(): AppConfiguration['reconciliation'] {
    return this.values.reconciliation;
  }

  get isProduction(): boolean {
    return this.app.nodeEnv === 'production';
  }

  get isMockPaymentGateway(): boolean {
    return this.mock.paymentGateway;
  }
}

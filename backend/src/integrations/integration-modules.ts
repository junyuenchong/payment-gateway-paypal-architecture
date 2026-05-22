import { BullMqIntegrationModule } from './bullmq/bullmq.module';
import { ElasticsearchIntegrationModule } from './elasticsearch/elasticsearch.module';
import { MailIntegrationModule } from './mail/mail.module';
import { RedisIntegrationModule } from './redis/redis.module';
import { StorageIntegrationModule } from './storage/storage.module';

/** ----- Register external integrations in one place. ----- **/
export const INTEGRATION_MODULES = [
  RedisIntegrationModule,
  BullMqIntegrationModule,
  MailIntegrationModule,
  StorageIntegrationModule,
  ElasticsearchIntegrationModule,
];

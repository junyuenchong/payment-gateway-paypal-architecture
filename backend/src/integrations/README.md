# Integrations (`src/integrations`)

External services and infrastructure adapters. Not domain logic — wire here, use from `modules/`.

```text
integrations/
├── redis/           # ioredis connection helpers
├── bullmq/          # BullMQ forRoot (queues in modules/queue)
├── mail/            # placeholder
├── storage/         # placeholder
└── elasticsearch/   # placeholder
```

Registered in `integration-modules.ts` → `AppModule`.

| Folder | Module | Status |
| ------ | ------ | ------ |
| `redis/` | `RedisIntegrationModule` | `createRedisConnectionOptions()` for locks |
| `bullmq/` | `BullMqIntegrationModule` | Global Bull connection |
| `mail/` | `MailIntegrationModule` | Placeholder |
| `storage/` | `StorageIntegrationModule` | Placeholder |
| `elasticsearch/` | `ElasticsearchIntegrationModule` | Placeholder |

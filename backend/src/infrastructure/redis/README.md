# Redis connection

A single shared **ioredis** client for the app. Today it’s mainly used by distributed locks; you could reuse it for caching later.

```text
redis/
├── redis-connection.ts         # Builds options from AppConfigService
├── redis-connection.service.ts   # Singleton client (global module)
└── redis.module.ts
```

**Note:** BullMQ uses its **own** Redis connection via `@nestjs/bullmq` `forRoot` — not this client.

**Who uses it:** `infrastructure/locks` (`tryAcquire` / `release`).

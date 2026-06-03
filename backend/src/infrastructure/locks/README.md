# Distributed locks (Redis)

When you run **more than one API instance**, in-memory locks aren’t enough. This module uses Redis `SET NX PX` plus a Lua script to release safely.

```text
locks/
├── dto/lock.dto.ts
├── redis-lock.service.ts
├── locks.controller.ts      # try acquire / release (internal/ops)
└── locks.module.ts
```

No CQRS here — the service talks to `RedisConnectionService` directly.

**Different problem, different tool:** locking a **database row** inside a transaction uses `infrastructure/database/prisma/locks/row-lock.service.ts`.

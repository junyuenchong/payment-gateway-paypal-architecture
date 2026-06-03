# Prisma runtime (Nest)

How the running API talks to PostgreSQL. Schema and CLI migrations live in `backend/prisma/`; this folder is the **Nest module** around `PrismaClient`.

```text
prisma/
├── prisma.module.ts
├── prisma.service.ts              # Connect on boot
├── prisma-transaction.service.ts  # Wrapper for $transaction
├── prisma.extension.ts
└── locks/
    ├── advisory-lock.service.ts   # pg_advisory_xact_lock
    └── row-lock.service.ts        # SELECT … FOR UPDATE
```

---

## How to use it in domain code

- Prefer **`PrismaTransactionService.run(fn)`** when several writes must succeed or fail together.
- Prefer **`RowLockService`** when two requests might update the same product row — don’t copy-paste `FOR UPDATE` SQL into every service.

`PrismaModule` is global; inject `PrismaService` or the transaction/lock services as needed.

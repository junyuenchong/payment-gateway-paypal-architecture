# Common code

Shared building blocks that **don’t talk to PayPal, Redis, or the database directly**. Domain modules and infrastructure both import from here.

| Folder | What’s inside |
|--------|----------------|
| `config/` | Reads `.env`, exposes typed `AppConfigService` |
| `shared/` | HTTP filters, Zod validation pipe, pagination DTOs, error helpers |

**Rule of thumb:** `common/` must not import from `modules/` or `infrastructure/` — that keeps dependency direction clean.

- [Config](./config/README.md)
- [Shared](./shared/README.md)

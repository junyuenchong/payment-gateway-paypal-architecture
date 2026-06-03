# Shared utilities

Small helpers used by many modules — **not** business rules. Think: “how HTTP errors look” and “how we validate request bodies.”

```text
shared/
├── dto/           # Reusable query/body schemas (e.g. cursor pagination)
├── filters/       # Global HTTP exception filter
├── pipes/         # Zod validation pipe
└── helpers/       # Error normalization for logs
```

Import the file you need (there’s no barrel `index.ts`):

```typescript
import { toError } from '../../common/shared/helpers/error.util';
import { ZodValidationPipe } from '../../common/shared/pipes/zod-validation.pipe';
```

Path on disk: `src/common/shared/` (not `src/shared/`).

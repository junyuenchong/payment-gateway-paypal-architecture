# Shared (`src/shared`)

Cross-cutting utilities used by multiple modules. Not domain logic.

```text
shared/
├── dto/           # Reusable query/body schemas
├── filters/       # Global HTTP exception filter
├── pipes/         # Zod validation pipe
└── helpers/       # Error normalization / logging helpers
```

Import concrete files (no barrel `index.ts`):

```typescript
import { toError } from '../../shared/helpers/error.util';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
```

import { Controller, Get } from '@nestjs/common';

import type { IdempotencyStatusDto } from './dto/idempotency.dto';

/** ----- Handle idempotency module endpoints. ----- **/
@Controller('internal/idempotency')
export class IdempotencyController {
  /** ----- Get idempotency module status. ----- **/
  @Get('status')
  getStatus(): IdempotencyStatusDto {
    return { ok: true, module: 'idempotency' };
  }
}

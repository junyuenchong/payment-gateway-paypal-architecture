import { Controller, Get } from '@nestjs/common';

/** ----- Handle idempotency module endpoints. ----- **/
@Controller('internal/idempotency')
export class IdempotencyController {
  /** ----- Get idempotency module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'idempotency' } as const;
  }
}

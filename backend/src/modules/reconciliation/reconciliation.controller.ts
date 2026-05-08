import { Controller, Get } from '@nestjs/common';

/** ----- Handle reconciliation module endpoints. ----- **/
@Controller('internal/reconciliation')
export class ReconciliationController {
  /** ----- Get reconciliation module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'reconciliation' } as const;
  }
}

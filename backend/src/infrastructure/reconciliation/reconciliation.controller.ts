import { Controller, Get } from '@nestjs/common';

import type { ReconciliationStatusDto } from './dto/reconciliation.dto';

/** ----- Handle reconciliation module endpoints. ----- **/
@Controller('internal/reconciliation')
export class ReconciliationController {
  /** ----- Get reconciliation module status. ----- **/
  @Get('status')
  getStatus(): ReconciliationStatusDto {
    return { ok: true, module: 'reconciliation' };
  }
}

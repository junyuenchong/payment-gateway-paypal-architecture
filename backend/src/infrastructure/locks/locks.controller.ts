import { Controller, Get } from '@nestjs/common';

import type { LocksStatusDto } from './dto/lock.dto';

/** ----- Handle locks module endpoints. ----- **/
@Controller('internal/locks')
export class LocksController {
  /** ----- Get locks module status. ----- **/
  @Get('status')
  getStatus(): LocksStatusDto {
    return { ok: true, module: 'locks' };
  }
}

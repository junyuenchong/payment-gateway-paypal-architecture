import { Controller, Get } from '@nestjs/common';

/** ----- Handle locks module endpoints. ----- **/
@Controller('internal/locks')
export class LocksController {
  /** ----- Get locks module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'locks' } as const;
  }
}

import { Controller, Get } from '@nestjs/common';

/** ----- Handle queue module endpoints. ----- **/
@Controller('internal/queue')
export class QueueController {
  /** ----- Get queue module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'queue' } as const;
  }
}

import { Controller, Get } from '@nestjs/common';

/** ----- Handle event-bus module endpoints. ----- **/
@Controller('internal/event-bus')
export class EventBusController {
  /** ----- Get event-bus module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'event-bus' } as const;
  }
}

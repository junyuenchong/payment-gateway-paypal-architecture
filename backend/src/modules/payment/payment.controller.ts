import { Controller, Get } from '@nestjs/common';

/** ----- Handle payment module endpoints. ----- **/
@Controller('internal/payment')
export class PaymentController {
  /** ----- Get payment module status. ----- **/
  @Get('status')
  getStatus() {
    return { ok: true, module: 'payment' } as const;
  }
}

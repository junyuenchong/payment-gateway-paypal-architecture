import { Controller, Get } from '@nestjs/common';
import type { HealthStatusDto, RootStatusDto } from './dto/health.dto';

@Controller()
export class HealthController {
  /**
   * ------------------------------------------------------
   * Health Status Endpoint
   * ------------------------------------------------------
   */
  @Get('health')
  health(): HealthStatusDto {
    return { status: 'ok' };
  }

  /**
   * ------------------------------------------------------
   * Root Service Status Endpoint
   * ------------------------------------------------------
   */
  @Get()
  root(): RootStatusDto {
    return { service: 'paymentwebhook-backend', status: 'ok' };
  }
}

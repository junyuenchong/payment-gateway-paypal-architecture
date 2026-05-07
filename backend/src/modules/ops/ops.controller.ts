import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import { OpsService } from './ops.service';

@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('metrics')
  metrics() {
    return this.opsService.getMetrics();
  }

  @Get('dlq')
  dlq(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.opsService.listDlq(limit ?? 20);
  }

  @Post('dlq/:jobId/replay')
  replay(@Param('jobId') jobId: string) {
    return this.opsService.replayDlqJob(jobId);
  }
}

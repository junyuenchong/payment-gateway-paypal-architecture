import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { ZodValidationPipe } from '../../common/shared/pipes/zod-validation.pipe';
import {
  ListDlqQuerySchema,
  ReplayDlqParamSchema,
  ReplayDlqQuerySchema,
  type ListDlqQuery,
  type ReplayDlqParam,
  type ReplayDlqQuery,
} from './dto/ops.dto';
import { OpsService } from './ops.service';

/** ----- Handle ops endpoints for DLQ and queue metrics. ----- **/
@SkipThrottle()
@Controller('ops')
export class OpsController {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly ops: OpsService) {}

  /** ----- List failed BullMQ jobs (dead-letter). ----- **/
  @Get('dlq')
  listDlq(
    @Query(new ZodValidationPipe(ListDlqQuerySchema)) query: ListDlqQuery,
  ) {
    return this.ops.listDlq({ limit: query.limit, queue: query.queue });
  }

  /** ----- Replay one failed job onto its original queue. ----- **/
  @Post('dlq/:jobId/replay')
  replay(
    @Param(new ZodValidationPipe(ReplayDlqParamSchema))
    params: ReplayDlqParam,
    @Query(new ZodValidationPipe(ReplayDlqQuerySchema)) query: ReplayDlqQuery,
  ) {
    return this.ops.replayDlqJob({ queue: query.queue, jobId: params.jobId });
  }

  /** ----- Get queue depth and health metrics. ----- **/
  @Get('metrics')
  metrics() {
    return this.ops.getMetrics();
  }
}

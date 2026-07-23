import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import {
  AUDIT_QUEUE,
  EMAIL_QUEUE,
  NOTIFICATION_QUEUE,
} from '../bullmq/bullmq.constants';
import { toError } from '../../common/shared/helpers/error.util';
import type { DlqJobDto, OpsMetricsDto, QueueMetricsDto } from './dto/ops.dto';

/** ----- Ops helpers for failed-job DLQ and queue metrics. ----- **/
@Injectable()
export class OpsService {
  private readonly log = new Logger(OpsService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(AUDIT_QUEUE) private readonly auditQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  /** ----- Resolve named BullMQ queues used by the app. ----- **/
  private queues(): Array<{ name: string; queue: Queue }> {
    return [
      { name: EMAIL_QUEUE, queue: this.emailQueue },
      { name: AUDIT_QUEUE, queue: this.auditQueue },
      { name: NOTIFICATION_QUEUE, queue: this.notificationQueue },
    ];
  }

  /** ----- Find a queue by configured name. ----- **/
  private queueByName(name: string): Queue {
    const found = this.queues().find((q) => q.name === name);
    if (!found) {
      throw new BadRequestException(
        `Unknown queue "${name}". Expected one of: ${this.queues()
          .map((q) => q.name)
          .join(', ')}`,
      );
    }
    return found.queue;
  }

  /** ----- Map a BullMQ failed job into a DLQ DTO. ----- **/
  private toDlqJob(queueName: string, job: Job): DlqJobDto {
    return {
      id: String(job.id),
      queue: queueName,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      timestamp: job.timestamp ?? null,
      data: job.data,
    };
  }

  /** ----- List failed jobs (dead-letter) across queues. ----- **/
  async listDlq(params: {
    limit: number;
    queue?: string;
  }): Promise<DlqJobDto[]> {
    try {
      const selected = params.queue
        ? [{ name: params.queue, queue: this.queueByName(params.queue) }]
        : this.queues();

      const perQueue = Math.max(1, Math.ceil(params.limit / selected.length));
      const batches = await Promise.all(
        selected.map(async ({ name, queue }) => {
          const failed = await queue.getFailed(0, perQueue - 1);
          return failed.map((job) => this.toDlqJob(name, job));
        }),
      );

      return batches
        .flat()
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, params.limit);
    } catch (error: unknown) {
      const normalized = toError(error, 'List DLQ failed');
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }

  /** ----- Replay one failed job back onto its queue. ----- **/
  async replayDlqJob(params: {
    queue: string;
    jobId: string;
  }): Promise<{ ok: true; queue: string; jobId: string }> {
    try {
      const queue = this.queueByName(params.queue);
      const job = await queue.getJob(params.jobId);
      if (!job) {
        throw new NotFoundException(
          `Job ${params.jobId} not found on queue ${params.queue}`,
        );
      }

      const state = await job.getState();
      if (state !== 'failed') {
        throw new BadRequestException(
          `Job ${params.jobId} is "${state}", not failed`,
        );
      }

      await job.retry();
      return { ok: true, queue: params.queue, jobId: params.jobId };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const normalized = toError(error, 'Replay DLQ job failed');
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }

  /** ----- Collect waiting/active/failed counts per queue. ----- **/
  async getMetrics(): Promise<OpsMetricsDto> {
    try {
      const queues: QueueMetricsDto[] = await Promise.all(
        this.queues().map(async ({ name, queue }) => {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'failed',
            'completed',
          );
          return {
            queue: name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
            completed: counts.completed ?? 0,
          };
        }),
      );
      return { queues };
    } catch (error: unknown) {
      const normalized = toError(error, 'Get queue metrics failed');
      this.log.error(normalized.stack ?? normalized.message);
      throw normalized;
    }
  }
}

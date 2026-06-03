import { BullModule } from '@nestjs/bullmq';

import { AppConfigModule, AppConfigService } from '../../../common/config';
import { buildDefaultJobOptions } from '../helpers/queue.defaults';
import { AUDIT_QUEUE } from '../bullmq.constants';

/** ----- Register audit (webhook) BullMQ queue. ----- **/
export const AuditQueueModule = BullModule.registerQueueAsync({
  name: AUDIT_QUEUE,
  imports: [AppConfigModule],
  inject: [AppConfigService],
  useFactory: (cfg: AppConfigService) => ({
    defaultJobOptions: buildDefaultJobOptions(cfg),
  }),
});

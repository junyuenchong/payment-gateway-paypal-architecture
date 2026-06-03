import { BullModule } from '@nestjs/bullmq';

import { AppConfigModule, AppConfigService } from '../../../common/config';
import { buildDefaultJobOptions } from '../helpers/queue.defaults';
import { EMAIL_QUEUE } from '../bullmq.constants';

/** ----- Register email (payment) BullMQ queue. ----- **/
export const EmailQueueModule = BullModule.registerQueueAsync({
  name: EMAIL_QUEUE,
  imports: [AppConfigModule],
  inject: [AppConfigService],
  useFactory: (cfg: AppConfigService) => ({
    defaultJobOptions: buildDefaultJobOptions(cfg),
  }),
});

import { BullModule } from '@nestjs/bullmq';

import { AppConfigModule, AppConfigService } from '../../../common/config';
import { buildDefaultJobOptions } from '../helpers/queue.defaults';
import { NOTIFICATION_QUEUE } from '../bullmq.constants';

/** ----- Register notification (sweep) BullMQ queue. ----- **/
export const NotificationQueueModule = BullModule.registerQueueAsync({
  name: NOTIFICATION_QUEUE,
  imports: [AppConfigModule],
  inject: [AppConfigService],
  useFactory: (cfg: AppConfigService) => ({
    defaultJobOptions: buildDefaultJobOptions(cfg),
  }),
});

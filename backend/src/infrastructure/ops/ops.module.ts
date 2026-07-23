import { Module } from '@nestjs/common';

import { BullMqIntegrationModule } from '../bullmq/bullmq.module';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

/** ----- Configure ops module (DLQ list/replay + metrics). ----- **/
@Module({
  imports: [BullMqIntegrationModule],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}

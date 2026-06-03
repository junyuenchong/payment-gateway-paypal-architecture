import { Module } from '@nestjs/common';

import { AppConfigModule } from './common/config';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { FEATURE_MODULES } from './modules/feature-modules';

/** ----- Configure root application module. ----- **/
@Module({
  imports: [AppConfigModule, PrismaModule, ...FEATURE_MODULES],
})
export class AppModule {}

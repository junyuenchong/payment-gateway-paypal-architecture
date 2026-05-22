import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { PrismaModule } from './database/prisma/prisma.module';
import { INTEGRATION_MODULES } from './integrations/integration-modules';
import { FEATURE_MODULES } from './modules/feature-modules';

/** ----- Configure root application module. ----- **/
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ...INTEGRATION_MODULES,
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}

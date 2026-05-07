import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

const Providers = [PrismaService];
const Exports = [...Providers];

@Global()
@Module({
  providers: [...Providers],
  exports: [...Exports],
})
export class PrismaModule {}

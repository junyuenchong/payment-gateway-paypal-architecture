import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/** ----- Global database access (register in AppModule, not under modules/). ----- **/
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

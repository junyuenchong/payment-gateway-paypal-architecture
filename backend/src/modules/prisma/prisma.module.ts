import { Global, Module } from '@nestjs/common';

import { PrismaController } from './prisma.controller';
import { PrismaRepository } from './prisma.repository';
import { PrismaService } from './prisma.service';

/** ----- Configure Prisma module. ----- **/
@Global()
@Module({
  controllers: [PrismaController],
  providers: [PrismaService, PrismaRepository],
  exports: [PrismaService],
})
/** ----- Handle prism odule class ----- **/
export class PrismaModule {}

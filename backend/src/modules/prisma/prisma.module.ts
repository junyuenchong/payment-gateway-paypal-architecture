import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { PrismaController } from './prisma.controller';
import { PrismaRepository } from './prisma.repository';
import { PrismaService } from './prisma.service';

/** ----- Configure Prisma module. ----- **/
@Module({
  imports: [CqrsModule],
  controllers: [PrismaController],
  providers: [PrismaService, PrismaRepository],
  exports: [PrismaService],
})
/** ----- Handle prism odule class ----- **/
export class PrismaModule {}

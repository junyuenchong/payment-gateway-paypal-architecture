import { Global, Module } from '@nestjs/common';

import { AdvisoryLockService, RowLockService } from './locks';
import { PrismaTransactionService } from './prisma-transaction.service';
import { PrismaService } from './prisma.service';

/** ----- Global database access (register in AppModule, not under modules/). ----- **/
@Global()
@Module({
  providers: [
    PrismaService,
    PrismaTransactionService,
    RowLockService,
    AdvisoryLockService,
  ],
  exports: [
    PrismaService,
    PrismaTransactionService,
    RowLockService,
    AdvisoryLockService,
  ],
})
export class PrismaModule {}

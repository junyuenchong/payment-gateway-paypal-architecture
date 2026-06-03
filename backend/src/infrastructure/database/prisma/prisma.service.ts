import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** ----- Global Prisma client (infrastructure, not a domain module). ----- **/
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** ----- Connect Prisma on application bootstrap. ----- **/
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** ----- Disconnect Prisma on application shutdown. ----- **/
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** ----- Handle prism ervice class ----- **/
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /** ----- Connect Prisma client. ----- **/
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** ----- Disconnect Prisma client. ----- **/
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

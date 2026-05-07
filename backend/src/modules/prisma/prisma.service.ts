import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * ------------------------------------------------------
   * Prisma Connection Lifecycle - Init
   * ------------------------------------------------------
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * ------------------------------------------------------
   * Prisma Connection Lifecycle - Destroy
   * ------------------------------------------------------
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

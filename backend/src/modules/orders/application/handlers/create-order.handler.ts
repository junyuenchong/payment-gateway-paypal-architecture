import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus } from '../../order-status';
import { CreateOrderCommand } from '../commands/create-order.command';

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ------------------------------------------------------
   * Create Order Record
   * ------------------------------------------------------
   */
  async execute(
    command: CreateOrderCommand,
  ): Promise<{ id: string; idempotencyKey: string }> {
    const currency = (
      command.currency ??
      this.config.get<string>('PAYPAL_CURRENCY') ??
      'MYR'
    ).toUpperCase();
    const idempotencyKey = `order_${randomUUID()}`;

    const order = await this.prisma.order.create({
      data: {
        amount: new Prisma.Decimal(command.amount),
        currency,
        externalRef: command.externalRef,
        idempotencyKey,
        status: OrderStatus.UNPAID,
      },
    });

    return { id: order.id, idempotencyKey: order.idempotencyKey };
  }
}

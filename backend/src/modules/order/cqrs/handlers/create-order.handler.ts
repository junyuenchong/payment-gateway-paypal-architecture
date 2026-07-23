import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { OrderService } from '../../order.service';
import { CreateOrderCommand } from '../commands/create-order.command';

/** ----- Handle create order command. ----- **/
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly orders: OrderService) {}

  /** ----- Create order record (idempotent by client key). ----- **/
  async execute(
    command: CreateOrderCommand,
  ): Promise<{ id: string; idempotencyKey: string }> {
    return this.orders.createOrder({
      amount: command.amount,
      currency: command.currency,
      externalRef: command.externalRef,
      items: command.items,
      idempotencyKey: command.idempotencyKey,
    });
  }
}

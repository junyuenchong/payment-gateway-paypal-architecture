import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CursorPaginationQueryDtoSchema,
  type CursorPaginationQueryDto,
} from '../../common/dto/cursor-pagination-query.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ScheduleCapturePaymentCommand } from './application/commands/schedule-capture-payment.command';
import { CreateOrderCommand } from './application/commands/create-order.command';
import { CreatePaymentIntentCommand } from './application/commands/create-payment-intent.command';
import { GetOrderQuery } from './application/queries/get-order.query';
import { ListOrdersQuery } from './application/queries/list-orders.query';
import {
  CreateOrderInputSchema,
  OrderIdParamInputSchema,
  type CreateOrderInput,
  type OrderIdParamInput,
} from './dto/order.input';

/** ----- Handle order ontroller class ----- **/
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** ----- Create Order ----- **/
  @Post()
  create(
    @Body(new ZodValidationPipe(CreateOrderInputSchema)) dto: CreateOrderInput,
  ) {
    return this.commandBus.execute(
      new CreateOrderCommand(dto.amount, dto.currency, dto.externalRef),
    );
  }

  /** ----- Get Order List ----- **/
  @Get()
  list(
    @Query(new ZodValidationPipe(CursorPaginationQueryDtoSchema))
    query: CursorPaginationQueryDto,
  ) {
    return this.queryBus.execute(ListOrdersQuery.fromDto(query));
  }

  /** ----- Get Order Details ----- **/
  @Get(':id')
  get(
    @Param(new ZodValidationPipe(OrderIdParamInputSchema))
    params: OrderIdParamInput,
    @Query(new ZodValidationPipe(CursorPaginationQueryDtoSchema))
    query: CursorPaginationQueryDto,
  ) {
    return this.queryBus.execute(GetOrderQuery.fromDto(params.id, query));
  }

  /** ----- Create Payment Intent ----- **/
  @Post(':id/payment-intent')
  paymentIntent(
    @Param(new ZodValidationPipe(OrderIdParamInputSchema))
    params: OrderIdParamInput,
  ) {
    return this.commandBus.execute(new CreatePaymentIntentCommand(params.id));
  }

  /** ----- Capture Payment ----- **/
  @Post(':id/capture')
  capture(
    @Param(new ZodValidationPipe(OrderIdParamInputSchema))
    params: OrderIdParamInput,
  ) {
    return this.commandBus.execute(
      new ScheduleCapturePaymentCommand(params.id),
    );
  }
}

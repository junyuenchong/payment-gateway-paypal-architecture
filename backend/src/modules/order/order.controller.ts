import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import {
  CursorPaginationQueryDtoSchema,
  type CursorPaginationQueryDto,
} from '../../common/shared/dto/cursor-pagination-query.dto';
import { ZodValidationPipe } from '../../common/shared/pipes/zod-validation.pipe';
import configuration from '../../common/config/configuration';
import { ScheduleCapturePaymentCommand } from './cqrs/commands/schedule-capture-payment.command';
import { CreateOrderCommand } from './cqrs/commands/create-order.command';
import { CreatePaymentIntentCommand } from './cqrs/commands/create-payment-intent.command';
import { GetOrderQuery } from './cqrs/queries/get-order.query';
import { ListOrdersQuery } from './cqrs/queries/list-orders.query';
import {
  CreateOrderInputSchema,
  OrderIdParamInputSchema,
  type CreateOrderInput,
  type OrderIdParamInput,
} from './dto/order.input';

/** ----- Stricter throttle for payment write endpoints. ----- **/
const paymentThrottle = {
  default: {
    limit: () => configuration().rateLimit.paymentLimit,
    ttl: () => configuration().rateLimit.paymentTtlMs,
  },
} as const;

/** ----- Handle order controller class ----- **/
@Controller('orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /** ----- Create Order ----- **/
  @Post()
  @Throttle(paymentThrottle)
  create(
    @Body(new ZodValidationPipe(CreateOrderInputSchema)) dto: CreateOrderInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.commandBus.execute(
      new CreateOrderCommand(
        dto.amount,
        dto.currency,
        dto.externalRef,
        dto.items,
        idempotencyKey?.trim() || undefined,
      ),
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
  @Throttle(paymentThrottle)
  paymentIntent(
    @Param(new ZodValidationPipe(OrderIdParamInputSchema))
    params: OrderIdParamInput,
  ) {
    return this.commandBus.execute(new CreatePaymentIntentCommand(params.id));
  }

  /** ----- Capture Payment ----- **/
  @Post(':id/capture')
  @Throttle(paymentThrottle)
  capture(
    @Param(new ZodValidationPipe(OrderIdParamInputSchema))
    params: OrderIdParamInput,
  ) {
    return this.commandBus.execute(
      new ScheduleCapturePaymentCommand(params.id),
    );
  }
}

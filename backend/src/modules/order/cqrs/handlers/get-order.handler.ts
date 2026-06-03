import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { OrderService } from '../../order.service';
import { GetOrderQuery } from '../queries/get-order.query';

/** ----- Handle ge rde andler class ----- **/
@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly orders: OrderService) {}

  /** ----- Get Order Details (With Event Pagination) ----- **/
  async execute(query: GetOrderQuery) {
    return this.orders.getOrderWithEvents({
      id: query.id,
      eventsCursor: query.eventsCursor ?? null,
      eventsLimit: query.eventsLimit,
      eventsDirection: query.eventsDirection,
    });
  }
}

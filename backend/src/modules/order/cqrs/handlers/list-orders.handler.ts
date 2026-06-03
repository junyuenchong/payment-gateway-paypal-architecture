import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { OrderService } from '../../order.service';
import { ListOrdersQuery } from '../queries/list-orders.query';

/** ----- Handle lis rder andler class ----- **/
@QueryHandler(ListOrdersQuery)
export class ListOrdersHandler implements IQueryHandler<ListOrdersQuery> {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(private readonly orders: OrderService) {}

  /** ----- List Orders (Cursor Pagination) ----- **/
  async execute(query: ListOrdersQuery) {
    return this.orders.listOrders({
      cursor: query.cursor ?? null,
      limit: query.limit,
      direction: query.direction,
    });
  }
}

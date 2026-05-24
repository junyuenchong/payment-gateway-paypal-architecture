import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { InventoryService } from '../../inventory.service';
import { ListOrderReservationsQuery } from '../queries/list-order-reservations.query';

@QueryHandler(ListOrderReservationsQuery)
export class ListOrderReservationsHandler implements IQueryHandler<ListOrderReservationsQuery> {
  constructor(private readonly inventory: InventoryService) {}

  execute(query: ListOrderReservationsQuery) {
    return this.inventory.listOrderReservations(query.orderId);
  }
}

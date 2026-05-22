import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { InventoryService } from '../../inventory.service';
import { ListProductsQuery } from '../queries/list-products.query';

/** ----- Handle list product availability query. ----- **/
@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery> {
  constructor(private readonly inventory: InventoryService) {}

  async execute(query: ListProductsQuery) {
    void query;
    return this.inventory.listProductsAvailability();
  }
}

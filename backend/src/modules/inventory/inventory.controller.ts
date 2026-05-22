import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { ListProductsQuery } from './application/queries/list-products.query';

/** ----- Read-only inventory availability API. ----- **/
@Controller('inventory')
export class InventoryController {
  constructor(private readonly queryBus: QueryBus) {}

  /** ----- List SKU availability (on-hand / reserved / sellable). ----- **/
  @Get('products')
  listProducts() {
    return this.queryBus.execute(new ListProductsQuery());
  }
}

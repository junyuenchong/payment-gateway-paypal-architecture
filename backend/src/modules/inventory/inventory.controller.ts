import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { ListOrderReservationsQuery } from './cqrs/queries/list-order-reservations.query';
import { ListProductsQuery } from './cqrs/queries/list-products.query';

/** ----- Read-only inventory availability API. ----- **/
@Controller('inventory')
export class InventoryController {
  constructor(private readonly queryBus: QueryBus) {}

  /** ----- List SKU availability (on-hand / reserved / sellable). ----- **/
  @Get('products')
  listProducts() {
    return this.queryBus.execute(new ListProductsQuery());
  }

  /** ----- Reservation audit trail for an order (production ops / support). ----- **/
  @Get('orders/:orderId/reservations')
  listOrderReservations(@Param('orderId') orderId: string) {
    return this.queryBus.execute(new ListOrderReservationsQuery(orderId));
  }
}

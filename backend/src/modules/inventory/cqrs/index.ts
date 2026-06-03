import { ExpireStaleReservationsHandler } from './handlers/expire-stale-reservations.handler';
import { ExpireUnpaidOrdersHandler } from './handlers/expire-unpaid-orders.handler';
import { ListOrderReservationsHandler } from './handlers/list-order-reservations.handler';
import { ListProductsHandler } from './handlers/list-products.handler';

export const CommandHandlers = [
  ExpireStaleReservationsHandler,
  ExpireUnpaidOrdersHandler,
];

export const QueryHandlers = [
  ListProductsHandler,
  ListOrderReservationsHandler,
];

export const EventHandlers: never[] = [];

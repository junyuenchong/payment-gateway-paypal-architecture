import { ExpireStaleReservationsHandler } from '../application/handlers/expire-stale-reservations.handler';
import { ExpireUnpaidOrdersHandler } from '../application/handlers/expire-unpaid-orders.handler';
import { ListProductsHandler } from '../application/handlers/list-products.handler';

export const CommandHandlers = [
  ExpireStaleReservationsHandler,
  ExpireUnpaidOrdersHandler,
];

export const QueryHandlers = [ListProductsHandler];

export const EventHandlers: never[] = [];

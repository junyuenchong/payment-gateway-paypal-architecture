import { CaptureCheckoutOrderHandler } from '../application/handlers/capture-checkout-order.handler';
import { CreateCheckoutOrderHandler } from '../application/handlers/create-checkout-order.handler';

export const CommandHandlers = [
  CreateCheckoutOrderHandler,
  CaptureCheckoutOrderHandler,
];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];

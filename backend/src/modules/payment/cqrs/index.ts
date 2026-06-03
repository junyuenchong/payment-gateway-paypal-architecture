import { CaptureCheckoutOrderHandler } from './handlers/capture-checkout-order.handler';
import { CreateCheckoutOrderHandler } from './handlers/create-checkout-order.handler';

export const CommandHandlers = [
  CreateCheckoutOrderHandler,
  CaptureCheckoutOrderHandler,
];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];

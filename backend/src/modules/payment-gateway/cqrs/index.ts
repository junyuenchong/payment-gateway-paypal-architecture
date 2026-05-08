import { CaptureGatewayCheckoutOrderHandler } from '../application/handlers/capture-gateway-checkout-order.handler';
import { CreateGatewayCheckoutOrderHandler } from '../application/handlers/create-gateway-checkout-order.handler';
import { GetGatewayCheckoutOrderStatusHandler } from '../application/handlers/get-gateway-checkout-order-status.handler';

export const CommandHandlers = [
  CreateGatewayCheckoutOrderHandler,
  CaptureGatewayCheckoutOrderHandler,
  GetGatewayCheckoutOrderStatusHandler,
];

export const QueryHandlers: never[] = [];
export const EventHandlers: never[] = [];

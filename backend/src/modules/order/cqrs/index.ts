import { CapturePaymentHandler } from './handlers/capture-payment.handler';
import { ScheduleCapturePaymentHandler } from './handlers/schedule-capture-payment.handler';
import { CreateOrderHandler } from './handlers/create-order.handler';
import { CreatePaymentIntentHandler } from './handlers/create-payment-intent.handler';
import { GetOrderHandler } from './handlers/get-order.handler';
import { ListOrdersHandler } from './handlers/list-orders.handler';

export const CommandHandlers = [
  CreateOrderHandler,
  CreatePaymentIntentHandler,
  CapturePaymentHandler,
  ScheduleCapturePaymentHandler,
];

export const QueryHandlers = [ListOrdersHandler, GetOrderHandler];

export const EventHandlers: never[] = [];

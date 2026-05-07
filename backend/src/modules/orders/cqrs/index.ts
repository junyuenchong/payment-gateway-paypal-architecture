import { CapturePaymentHandler } from '../application/handlers/capture-payment.handler';
import { ScheduleCapturePaymentHandler } from '../application/handlers/schedule-capture-payment.handler';
import { CreateOrderHandler } from '../application/handlers/create-order.handler';
import { CreatePaymentIntentHandler } from '../application/handlers/create-payment-intent.handler';
import { GetOrderHandler } from '../application/handlers/get-order.handler';
import { ListOrdersHandler } from '../application/handlers/list-orders.handler';

export const CommandHandlers = [
  CreateOrderHandler,
  CreatePaymentIntentHandler,
  CapturePaymentHandler,
  ScheduleCapturePaymentHandler,
];

export const QueryHandlers = [ListOrdersHandler, GetOrderHandler];

export const EventHandlers: never[] = [];

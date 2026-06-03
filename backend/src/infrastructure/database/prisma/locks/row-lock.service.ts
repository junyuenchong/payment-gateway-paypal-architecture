import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type {
  OrderApprovalUrlLockRow,
  OrderCaptureLockRow,
  OrderGatewayFieldsLockRow,
  OrderPaymentIntentLockRow,
  OrderPaymentIntentWorkerLockRow,
  OrderStatusLockRow,
  ProductSkuLockRow,
  WebhookEventStatusLockRow,
} from './row-lock.types';

type Tx = Prisma.TransactionClient;

/** ----- Centralized SELECT … FOR UPDATE helpers. ----- **/
@Injectable()
export class RowLockService {
  /** ----- Lock order for domain payment-intent handler. ----- **/
  findOrderForPaymentIntent(
    tx: Tx,
    orderId: string,
  ): Promise<OrderPaymentIntentLockRow[]> {
    return tx.$queryRaw<OrderPaymentIntentLockRow[]>`
      SELECT
        id,
        status::text as status,
        currency,
        "paypalOrderId",
        "approvalUrl"
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock order for queue payment-intent worker. ----- **/
  findOrderForPaymentIntentWorker(
    tx: Tx,
    orderId: string,
  ): Promise<OrderPaymentIntentWorkerLockRow[]> {
    return tx.$queryRaw<OrderPaymentIntentWorkerLockRow[]>`
      SELECT
        id,
        status::text as status,
        currency,
        "paypalOrderId",
        "approvalUrl",
        amount::text as amount
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock order for capture flow. ----- **/
  findOrderForCapture(
    tx: Tx,
    orderId: string,
  ): Promise<OrderCaptureLockRow[]> {
    return tx.$queryRaw<OrderCaptureLockRow[]>`
      SELECT id, status, "paypalOrderId"
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock order id + status only. ----- **/
  findOrderStatus(
    tx: Tx,
    orderId: string,
  ): Promise<OrderStatusLockRow[]> {
    return tx.$queryRaw<OrderStatusLockRow[]>`
      SELECT id, status::text as status
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock order id + status (non-text cast). ----- **/
  findOrderIdAndStatus(
    tx: Tx,
    orderId: string,
  ): Promise<OrderStatusLockRow[]> {
    return tx.$queryRaw<OrderStatusLockRow[]>`
      SELECT id, status
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock PayPal fields before mock gateway write. ----- **/
  findOrderGatewayFields(
    tx: Tx,
    orderId: string,
  ): Promise<OrderGatewayFieldsLockRow[]> {
    return tx.$queryRaw<OrderGatewayFieldsLockRow[]>`
      SELECT id, "approvalUrl", "paypalOrderId"
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock approval URL before live gateway write. ----- **/
  findOrderApprovalUrl(
    tx: Tx,
    orderId: string,
  ): Promise<OrderApprovalUrlLockRow[]> {
    return tx.$queryRaw<OrderApprovalUrlLockRow[]>`
      SELECT id, "approvalUrl"
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
  }

  /** ----- Lock product by SKU for inventory mutation. ----- **/
  findProductBySku(tx: Tx, sku: string): Promise<ProductSkuLockRow[]> {
    return tx.$queryRaw<ProductSkuLockRow[]>`
      SELECT id, sku, stock, "reservedStock"
      FROM "Product"
      WHERE sku = ${sku}
      FOR UPDATE
    `;
  }

  /** ----- Lock webhook event row by id. ----- **/
  findWebhookEventStatus(
    tx: Tx,
    webhookEventId: string,
  ): Promise<WebhookEventStatusLockRow[]> {
    return tx.$queryRaw<WebhookEventStatusLockRow[]>`
      SELECT id, status
      FROM "WebhookEvent"
      WHERE id = ${webhookEventId}
      FOR UPDATE
    `;
  }
}

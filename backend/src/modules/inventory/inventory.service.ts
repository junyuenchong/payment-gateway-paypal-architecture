import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppConfigService } from '../../config';
import { RedisLockService } from '../locks/redis-lock.service';
import type {
  OrderReservationAuditDto,
  ProductAvailabilityDto,
} from './dto/inventory.dto';
import { InventoryRepository } from './inventory.repository';
import { sortSkusForLock } from './inventory.constant';
import { availableStock } from './inventory.snapshot';

type Tx = Prisma.TransactionClient;

/** ----- Inventory domain service (checkout hold + payment settlement). ----- **/
@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly cfg: AppConfigService,
    private readonly redisLock: RedisLockService,
  ) {}

  checkoutReservationTtlMs(): number {
    return this.cfg.inventory.reservationTtlMs;
  }

  paymentReservationTtlMs(): number {
    return this.cfg.order.processingExpireMs;
  }

  private expiresAtFromMs(ttlMs: number): Date {
    return new Date(Date.now() + ttlMs);
  }

  /** ----- Reserve at order create (Amazon: checkout placement). ----- **/
  async reserveAtCheckout(orderId: string, tx: Tx): Promise<void> {
    const skus = await this.loadOrderSkus(orderId, tx);
    if (skus.length === 0) return;

    await this.withSkuLocks(skus, async () => {
      await this.repository.reserveForOrder(
        orderId,
        tx,
        this.expiresAtFromMs(this.checkoutReservationTtlMs()),
      );
    });
  }

  /** ----- Extend hold when payment intent starts. ----- **/
  async extendForPayment(orderId: string, tx: Tx): Promise<void> {
    const skus = await this.loadOrderSkus(orderId, tx);
    if (skus.length === 0) return;

    await this.withSkuLocks(skus, async () => {
      await this.repository.extendReservationForOrder(
        orderId,
        tx,
        this.expiresAtFromMs(this.paymentReservationTtlMs()),
      );
    });
  }

  /** PaymentCompleted → RESERVED to CONFIRMED + deduct on-hand (never delete row). */
  async commitForOrder(orderId: string, tx: Tx): Promise<void> {
    await this.repository.commitForOrder(orderId, tx);
  }

  /** PaymentExpired / failed / cancelled → RELEASED or EXPIRED + release reserved_stock. */
  async releaseForOrder(orderId: string, tx: Tx): Promise<void> {
    await this.repository.releaseForOrder(orderId, tx);
  }

  async restoreForRefund(orderId: string, tx: Tx): Promise<void> {
    await this.repository.restoreForRefund(orderId, tx);
  }

  /** CONFIRMED → FULFILLED after ship (row kept). */
  async fulfillForOrder(orderId: string, tx: Tx): Promise<void> {
    await this.repository.fulfillForOrder(orderId, tx);
  }

  listOrderReservations(orderId: string): Promise<OrderReservationAuditDto[]> {
    return this.repository.listReservationsByOrderId(orderId).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        productId: r.productId,
        sku: r.sku,
        quantity: r.quantity,
        status: r.status,
        reservationKey: r.reservationKey,
        expiresAt: r.expiresAt.toISOString(),
        reservedAt: r.reservedAt.toISOString(),
        confirmedAt: r.confirmedAt?.toISOString() ?? null,
        fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
        releasedAt: r.releasedAt?.toISOString() ?? null,
        expiredAt: r.expiredAt?.toISOString() ?? null,
        restockedAt: r.restockedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  }

  listProductsAvailability(): Promise<ProductAvailabilityDto[]> {
    return this.repository.listProductsAvailability().then((rows) =>
      rows.map((p) => ({
        sku: p.sku,
        name: p.name,
        totalStock: p.stock,
        onHand: p.stock,
        reserved: p.reservedStock,
        available: availableStock({
          totalStock: p.stock,
          reservedStock: p.reservedStock,
        }),
        version: p.version,
        updatedAt: p.updatedAt.toISOString(),
      })),
    );
  }

  expireStaleReservations(cutoff: Date) {
    return this.repository.expireStaleReservations(cutoff);
  }

  expireUnpaidOrdersWithoutActiveReservation(cutoff: Date) {
    return this.repository.expireUnpaidOrdersWithoutActiveReservation(cutoff);
  }

  private async loadOrderSkus(orderId: string, tx: Tx): Promise<string[]> {
    const items = await tx.orderLineItem.findMany({
      where: { orderId },
      select: { sku: true },
    });
    return sortSkusForLock(items.map((i) => i.sku));
  }

  /** ----- Per-SKU Redis locks (hot SKU protection across instances). ----- **/
  private async withSkuLocks<T>(
    skus: string[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const locks = [];
    try {
      for (const sku of skus) {
        const lock = await this.redisLock.tryAcquire(
          `lock:inventory:sku:${sku}`,
          10_000,
        );
        if (!lock) {
          throw new BadRequestException(
            `Inventory lock busy for SKU ${sku}. Retry shortly.`,
          );
        }
        locks.push(lock);
      }
      return await fn();
    } finally {
      for (const lock of locks.reverse()) {
        await this.redisLock.release(lock);
      }
    }
  }
}

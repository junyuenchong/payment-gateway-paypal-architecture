import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppConfigService } from '../../config';
import { RedisLockService } from '../locks/redis-lock.service';
import type { ProductAvailabilityDto } from './dto/inventory.dto';
import { InventoryRepository } from './inventory.repository';
import { sortSkusForLock } from './inventory.constant';

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

  async commitForOrder(orderId: string, tx: Tx): Promise<void> {
    await this.repository.commitForOrder(orderId, tx);
  }

  async releaseForOrder(orderId: string, tx: Tx): Promise<void> {
    await this.repository.releaseForOrder(orderId, tx);
  }

  async restoreForRefund(orderId: string, tx: Tx): Promise<void> {
    await this.repository.restoreForRefund(orderId, tx);
  }

  listProductsAvailability(): Promise<ProductAvailabilityDto[]> {
    return this.repository.listProductsAvailability().then((rows) =>
      rows.map((p) => ({
        sku: p.sku,
        name: p.name,
        onHand: p.stock,
        reserved: p.reservedStock,
        available: p.stock - p.reservedStock,
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

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppConfigService } from '../../common/config';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { RedisLockService } from '../../infrastructure/locks/redis-lock.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { RowLockService } from '../../infrastructure/database/prisma/locks/row-lock.service';
import { toError } from '../../common/shared/helpers/error.util';
import type {
  OrderReservationAuditDto,
  ProductAvailabilityDto,
} from './dto/inventory.dto';
import { OrderStatus } from '../order/enums/order-status.enum';
import { StockMovementReason } from './enums/stock-movement-reason.enum';
import {
  StockReservationStatus,
  TERMINAL_STOCK_RESERVATION_STATUSES,
} from './enums/stock-reservation-status.enum';
import { buildReservationKey, sortSkusForLock } from './helpers/inventory.helper';
import { assertProductInventoryInvariant } from './helpers/inventory.invariant';
import { availableStock } from './helpers/inventory.snapshot';

type Tx = Prisma.TransactionClient;

type ProductRow = {
  id: string;
  sku: string;
  stock: number;
  reservedStock: number;
};

/** ----- Inventory domain service (checkout hold + payment settlement). ----- **/
@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly log = new Logger(InventoryService.name);

  /** ----- Handle constructor dependency wiring ----- **/
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLocks: RowLockService,
    private readonly cfg: AppConfigService,
    private readonly redisLock: RedisLockService,
    @Inject(forwardRef(() => QueueService))
    private readonly queue: QueueService,
  ) {}

  /** ----- Register inventory sweep jobs on module init. ----- **/
  async onModuleInit(): Promise<void> {
    // Upsert reservation TTL and unpaid-order cleanup repeat jobs
    await Promise.all([
      this.queue.upsertExpireReservationsSweep(
        this.cfg.inventory.reservationSweepEveryMs,
      ),
      this.queue.upsertExpireUnpaidOrdersSweep(
        this.cfg.inventory.unpaidOrderSweepEveryMs,
      ),
    ]).catch((err: unknown) => {
      const normalized = toError(err, 'Upsert inventory sweeps failed');
      this.log.error('Failed to upsert inventory sweep jobs');
      this.log.error(normalized.stack ?? normalized.message);
    });
  }

  /** ----- Checkout reservation TTL from config. ----- **/
  checkoutReservationTtlMs(): number {
    return this.cfg.inventory.reservationTtlMs;
  }

  /** ----- Payment-processing reservation TTL from config. ----- **/
  paymentReservationTtlMs(): number {
    return this.cfg.order.processingExpireMs;
  }

  /** ----- Compute reservation expiry from TTL milliseconds. ----- **/
  private expiresAtFromMs(ttlMs: number): Date {
    return new Date(Date.now() + ttlMs);
  }

  /** ----- Reserve at order create (Amazon: checkout placement). ----- **/
  async reserveAtCheckout(orderId: string, tx: Tx): Promise<void> {
    const skus = await this.loadOrderSkus(orderId, tx);
    if (skus.length === 0) return;

    await this.withSkuLocks(skus, async () => {
      await this.reserveForOrder(
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
      await this.extendReservationForOrder(
        orderId,
        tx,
        this.expiresAtFromMs(this.paymentReservationTtlMs()),
      );
    });
  }

  /** ----- List reservation audit rows for an order (API DTO). ----- **/
  listOrderReservations(orderId: string): Promise<OrderReservationAuditDto[]> {
    return this.listReservationsByOrderId(orderId).then((rows) =>
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

  /** ----- List product availability snapshot (API DTO). ----- **/
  listProductsAvailability(): Promise<ProductAvailabilityDto[]> {
    return this.queryProductsAvailability().then((rows) =>
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

  /** ----- Load order line SKUs in lock-safe sorted order. ----- **/
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

  /** ----- Audit: all reservation rows for an order (never deleted). ----- **/
  listReservationsByOrderId(orderId: string) {
    return this.prisma.stockReservation.findMany({
      where: { orderId },
      orderBy: [{ sku: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        orderId: true,
        productId: true,
        sku: true,
        quantity: true,
        status: true,
        reservationKey: true,
        expiresAt: true,
        reservedAt: true,
        confirmedAt: true,
        fulfilledAt: true,
        releasedAt: true,
        expiredAt: true,
        restockedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /** ----- List products with sellable quantity. ----- **/
  queryProductsAvailability() {
    return this.prisma.product.findMany({
      orderBy: { sku: 'asc' },
      select: {
        sku: true,
        name: true,
        stock: true,
        reservedStock: true,
        version: true,
        updatedAt: true,
      },
    });
  }

  /** ----- Reserve stock at checkout (order create). ----- **/
  async reserveForOrder(
    orderId: string,
    tx: Tx,
    expiresAt: Date,
  ): Promise<void> {
    const lineItems = await tx.orderLineItem.findMany({
      where: { orderId },
      orderBy: { sku: 'asc' },
    });
    if (lineItems.length === 0) return;

    const skus = sortSkusForLock(lineItems.map((i) => i.sku));
    for (const sku of skus) {
      const item = lineItems.find((i) => i.sku === sku);
      if (!item) continue;

      const reservationKey = buildReservationKey(orderId, sku);
      const existing = await tx.stockReservation.findUnique({
        where: { reservationKey },
      });
      if (existing?.status === StockReservationStatus.RESERVED) {
        await tx.stockReservation.update({
          where: { id: existing.id },
          data: { expiresAt },
        });
        continue;
      }
      if (
        existing?.status &&
        TERMINAL_STOCK_RESERVATION_STATUSES.includes(
          existing.status as (typeof TERMINAL_STOCK_RESERVATION_STATUSES)[number],
        )
      ) {
        throw new BadRequestException(
          `Cannot re-reserve ${sku} for order ${orderId} (reservation ${existing?.status})`,
        );
      }

      const product = await this.lockAndReserveSku(tx, {
        sku,
        quantity: item.quantity,
        orderId,
        reservationKey,
        expiresAt,
        reason: StockMovementReason.RESERVE,
      });

      await tx.stockReservation.create({
        data: {
          orderId,
          productId: product.id,
          sku,
          quantity: item.quantity,
          status: StockReservationStatus.RESERVED,
          reservationKey,
          expiresAt,
        },
      });

      await this.appendLedger(tx, {
        productId: product.id,
        sku,
        orderId,
        quantity: item.quantity,
        stockDelta: 0,
        reservedDelta: item.quantity,
        reason: StockMovementReason.RESERVE,
        correlationId: orderId,
      });
      await this.assertProductAfterMutation(tx, sku);
    }
  }

  /** ----- Extend reservation TTL when payment starts. ----- **/
  async extendReservationForOrder(
    orderId: string,
    tx: Tx,
    expiresAt: Date,
  ): Promise<void> {
    const active = await tx.stockReservation.findMany({
      where: { orderId, status: StockReservationStatus.RESERVED },
    });
    if (active.length === 0) {
      await this.reserveForOrder(orderId, tx, expiresAt);
      return;
    }

    await tx.stockReservation.updateMany({
      where: { orderId, status: StockReservationStatus.RESERVED },
      data: { expiresAt },
    });

    for (const row of active) {
      const product = await tx.product.findFirst({ where: { sku: row.sku } });
      if (!product) continue;
      await this.appendLedger(tx, {
        productId: product.id,
        sku: row.sku,
        orderId,
        reservationId: row.id,
        quantity: row.quantity,
        stockDelta: 0,
        reservedDelta: 0,
        reason: StockMovementReason.EXTEND,
        correlationId: orderId,
      });
    }
  }

  /** ----- Payment success: RESERVED → CONFIRMED (row kept; sets confirmedAt). ----- **/
  async commitForOrder(orderId: string, tx: Tx): Promise<void> {
    const reservations = await tx.stockReservation.findMany({
      where: { orderId, status: StockReservationStatus.RESERVED },
      orderBy: { sku: 'asc' },
    });
    if (reservations.length === 0) return;

    const confirmedAt = new Date();
    for (const reservation of reservations) {
      const product = await this.lockProduct(tx, reservation.sku);
      if (product.reservedStock < reservation.quantity) {
        throw new BadRequestException(
          `Inventory invariant violated for ${reservation.sku} (reserved ${product.reservedStock}, need ${reservation.quantity})`,
        );
      }

      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: { decrement: reservation.quantity },
          reservedStock: { decrement: reservation.quantity },
          version: { increment: 1 },
        },
      });

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: StockReservationStatus.CONFIRMED,
          confirmedAt,
          productId: product.id,
        },
      });

      await this.appendLedger(tx, {
        productId: product.id,
        sku: reservation.sku,
        orderId,
        reservationId: reservation.id,
        quantity: reservation.quantity,
        stockDelta: -reservation.quantity,
        reservedDelta: -reservation.quantity,
        reason: StockMovementReason.CONFIRM,
        correlationId: orderId,
      });
      await this.assertProductAfterMutation(tx, reservation.sku);
    }
  }

  /** ----- Shipped / WMS: CONFIRMED → FULFILLED (no stock change). ----- **/
  async fulfillForOrder(orderId: string, tx: Tx): Promise<void> {
    const fulfilledAt = new Date();
    await tx.stockReservation.updateMany({
      where: { orderId, status: StockReservationStatus.CONFIRMED },
      data: { status: StockReservationStatus.FULFILLED, fulfilledAt },
    });
  }

  /** ----- Release reserved stock (fail / cancel / manual). ----- **/
  async releaseForOrder(
    orderId: string,
    tx: Tx,
    reason:
      | typeof StockMovementReason.RELEASE
      | typeof StockMovementReason.EXPIRE = StockMovementReason.RELEASE,
  ): Promise<void> {
    const reservations = await tx.stockReservation.findMany({
      where: { orderId, status: StockReservationStatus.RESERVED },
      orderBy: { sku: 'asc' },
    });
    if (reservations.length === 0) return;

    const nextStatus =
      reason === StockMovementReason.EXPIRE
        ? StockReservationStatus.EXPIRED
        : StockReservationStatus.RELEASED;
    const terminalAt = new Date();

    for (const reservation of reservations) {
      const product = await this.lockProduct(tx, reservation.sku);

      await tx.product.update({
        where: { id: product.id },
        data: {
          reservedStock: { decrement: reservation.quantity },
          version: { increment: 1 },
        },
      });

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: nextStatus,
          productId: product.id,
          ...(nextStatus === StockReservationStatus.EXPIRED
            ? { expiredAt: terminalAt }
            : { releasedAt: terminalAt }),
        },
      });

      await this.appendLedger(tx, {
        productId: product.id,
        sku: reservation.sku,
        orderId,
        reservationId: reservation.id,
        quantity: reservation.quantity,
        stockDelta: 0,
        reservedDelta: -reservation.quantity,
        reason,
        correlationId: orderId,
      });
      await this.assertProductAfterMutation(tx, reservation.sku);
    }
  }

  /** ----- Restore on-hand stock after full refund. ----- **/
  async restoreForRefund(orderId: string, tx: Tx): Promise<void> {
    const committed = await tx.stockReservation.findMany({
      where: {
        orderId,
        status: {
          in: [
            StockReservationStatus.CONFIRMED,
            StockReservationStatus.FULFILLED,
          ],
        },
      },
      orderBy: { sku: 'asc' },
    });
    if (committed.length === 0) return;

    const restockedAt = new Date();
    for (const reservation of committed) {
      const product = await this.lockProduct(tx, reservation.sku);

      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: { increment: reservation.quantity },
          version: { increment: 1 },
        },
      });

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: StockReservationStatus.RESTOCKED,
          restockedAt,
        },
      });

      await this.appendLedger(tx, {
        productId: product.id,
        sku: reservation.sku,
        orderId,
        reservationId: reservation.id,
        quantity: reservation.quantity,
        stockDelta: reservation.quantity,
        reservedDelta: 0,
        reason: StockMovementReason.RESTOCK,
        correlationId: orderId,
      });
      await this.assertProductAfterMutation(tx, reservation.sku);
    }
  }

  /** ----- Expire stale RESERVED rows (TTL sweep) → status EXPIRED. ----- **/
  async expireStaleReservations(cutoff: Date): Promise<{ count: number }> {
    const stale = await this.prisma.stockReservation.findMany({
      where: {
        status: StockReservationStatus.RESERVED,
        expiresAt: { lt: cutoff },
      },
      select: { orderId: true },
      distinct: ['orderId'],
    });

    if (stale.length === 0) return { count: 0 };

    for (const { orderId } of stale) {
      await this.prisma.$transaction(async (tx) => {
        await this.releaseForOrder(orderId, tx, StockMovementReason.EXPIRE);
        await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.UNPAID },
          data: { status: OrderStatus.EXPIRED },
        });
      });
    }

    return { count: stale.length };
  }

  /** ----- Mark UNPAID orders expired when reservation TTL elapsed. ----- **/
  async expireUnpaidOrdersWithoutActiveReservation(cutoff: Date) {
    return this.prisma.order.updateMany({
      where: {
        status: OrderStatus.UNPAID,
        updatedAt: { lt: cutoff },
        stockReservations: {
          none: { status: StockReservationStatus.RESERVED },
        },
      },
      data: { status: OrderStatus.EXPIRED },
    });
  }

  /** ----- Lock product row and increment reserved stock atomically. ----- **/
  private async lockAndReserveSku(
    tx: Tx,
    params: {
      sku: string;
      quantity: number;
      orderId: string;
      reservationKey: string;
      expiresAt: Date;
      reason: typeof StockMovementReason.RESERVE;
    },
  ): Promise<ProductRow> {
    void params.reservationKey;
    void params.expiresAt;
    void params.reason;

    const updated = (await tx.$queryRaw<ProductRow[]>`
      UPDATE "Product"
      SET
        "reservedStock" = "reservedStock" + ${params.quantity},
        version = version + 1,
        "updatedAt" = NOW()
      WHERE sku = ${params.sku}
        AND stock - "reservedStock" >= ${params.quantity}
      RETURNING id, sku, stock, "reservedStock"
    `) as ProductRow[];

    if (updated.length === 0) {
      const snapshot = await tx.product.findUnique({
        where: { sku: params.sku },
      });
      const available = snapshot
        ? snapshot.stock - snapshot.reservedStock
        : 0;
      throw new BadRequestException(
        `Insufficient stock for ${params.sku} (need ${params.quantity}, available ${available})`,
      );
    }

    const row = updated[0];
    assertProductInventoryInvariant(row);
    return row;
  }

  /** ----- SELECT FOR UPDATE on product by SKU. ----- **/
  private async lockProduct(tx: Tx, sku: string): Promise<ProductRow> {
    const rows = await this.rowLocks.findProductBySku(tx, sku);

    if (rows.length === 0) {
      throw new BadRequestException(`Product not found: ${sku}`);
    }

    const row = rows[0];
    assertProductInventoryInvariant(row);
    return row;
  }

  /** ----- Re-read product and assert CHECK constraints after mutation. ----- **/
  private async assertProductAfterMutation(tx: Tx, sku: string): Promise<void> {
    const row = await tx.product.findUnique({
      where: { sku },
      select: { sku: true, stock: true, reservedStock: true },
    });
    if (!row) {
      throw new BadRequestException(`Product not found after mutation: ${sku}`);
    }
    assertProductInventoryInvariant(row);
  }

  /** ----- Append immutable stock ledger entry. ----- **/
  private async appendLedger(
    tx: Tx,
    entry: {
      productId: string;
      sku: string;
      orderId?: string;
      reservationId?: string;
      quantity: number;
      stockDelta: number;
      reservedDelta: number;
      reason: (typeof StockMovementReason)[keyof typeof StockMovementReason];
      correlationId?: string;
    },
  ): Promise<void> {
    await tx.stockLedgerEntry.create({
      data: {
        productId: entry.productId,
        sku: entry.sku,
        orderId: entry.orderId,
        reservationId: entry.reservationId,
        quantity: entry.quantity,
        stockDelta: entry.stockDelta,
        reservedDelta: entry.reservedDelta,
        reason: entry.reason,
        correlationId: entry.correlationId,
      },
    });
  }

}
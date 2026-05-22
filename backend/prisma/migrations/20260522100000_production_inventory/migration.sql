-- Product optimistic concurrency + safety constraints
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "product_stock_non_negative";
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_non_negative" CHECK (stock >= 0);

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "product_reserved_non_negative";
ALTER TABLE "Product" ADD CONSTRAINT "product_reserved_non_negative" CHECK ("reservedStock" >= 0);

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "product_reserved_lte_stock";
ALTER TABLE "Product" ADD CONSTRAINT "product_reserved_lte_stock" CHECK ("reservedStock" <= stock);

-- Reservation TTL + idempotency key
ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "reservationKey" TEXT;

UPDATE "StockReservation"
SET "reservationKey" = 'legacy:' || id
WHERE "reservationKey" IS NULL;

ALTER TABLE "StockReservation" ALTER COLUMN "reservationKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "StockReservation_reservationKey_key"
  ON "StockReservation"("reservationKey");

CREATE INDEX IF NOT EXISTS "StockReservation_status_expiresAt_idx"
  ON "StockReservation"("status", "expiresAt");

-- Append-only inventory ledger (audit / reconciliation)
CREATE TYPE "StockMovementReason" AS ENUM (
  'RESERVE',
  'EXTEND',
  'COMMIT',
  'RELEASE',
  'EXPIRE',
  'RESTORE_REFUND'
);

CREATE TABLE "StockLedgerEntry" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "orderId" TEXT,
    "reservationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "stockDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockLedgerEntry_sku_createdAt_idx" ON "StockLedgerEntry"("sku", "createdAt");
CREATE INDEX "StockLedgerEntry_orderId_idx" ON "StockLedgerEntry"("orderId");

ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

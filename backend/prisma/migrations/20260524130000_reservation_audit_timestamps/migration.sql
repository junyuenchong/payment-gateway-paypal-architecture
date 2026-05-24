-- Enterprise audit: lifecycle timestamps + no cascade delete of reservation history

ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3);
ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);
ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);
ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "restockedAt" TIMESTAMP(3);

UPDATE "StockReservation"
SET "reservedAt" = COALESCE("reservedAt", "createdAt")
WHERE "reservedAt" IS NULL;

ALTER TABLE "StockReservation" ALTER COLUMN "reservedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StockReservation" ALTER COLUMN "reservedAt" SET NOT NULL;

-- Prevent order hard-delete from wiping reservation audit rows
ALTER TABLE "StockReservation" DROP CONSTRAINT IF EXISTS "StockReservation_orderId_fkey";
ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

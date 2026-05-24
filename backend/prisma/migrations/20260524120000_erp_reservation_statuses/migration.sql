-- ERP-aligned reservation statuses (keep rows; RESERVED -> CONFIRMED on pay)

ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);

UPDATE "StockReservation" sr
SET "productId" = p.id
FROM "Product" p
WHERE p.sku = sr.sku AND sr."productId" IS NULL;

UPDATE "StockReservation" SET status = 'RESERVED' WHERE status = 'ACTIVE';
UPDATE "StockReservation" SET status = 'CONFIRMED' WHERE status = 'COMMITTED';

ALTER TABLE "StockReservation" ALTER COLUMN "status" SET DEFAULT 'RESERVED';

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

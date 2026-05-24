-- Production: reservation status default, valid statuses, fulfilment timestamp

UPDATE "StockReservation" SET status = 'RESERVED' WHERE status = 'ACTIVE';
UPDATE "StockReservation" SET status = 'CONFIRMED' WHERE status = 'COMMITTED';

ALTER TABLE "StockReservation" ALTER COLUMN "status" SET DEFAULT 'RESERVED';

ALTER TABLE "StockReservation" ADD COLUMN IF NOT EXISTS "fulfilledAt" TIMESTAMP(3);

ALTER TABLE "StockReservation" DROP CONSTRAINT IF EXISTS "stock_reservation_status_valid";
ALTER TABLE "StockReservation" ADD CONSTRAINT "stock_reservation_status_valid"
  CHECK (status IN ('RESERVED', 'CONFIRMED', 'FULFILLED', 'RELEASED', 'EXPIRED', 'RESTOCKED'));

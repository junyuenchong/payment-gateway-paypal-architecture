-- Enums moved to backend/src/modules/*/enums; columns stored as TEXT.

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'UNPAID';

ALTER TABLE "WebhookEvent" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WebhookEvent" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "WebhookEvent" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

ALTER TABLE "StockReservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StockReservation" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
ALTER TABLE "StockReservation" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "StockLedgerEntry" ALTER COLUMN "reason" TYPE TEXT USING "reason"::text;

DROP TYPE IF EXISTS "StockMovementReason";
DROP TYPE IF EXISTS "StockReservationStatus";
DROP TYPE IF EXISTS "WebhookEventStatus";
DROP TYPE IF EXISTS "OrderStatus";

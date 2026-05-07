-- Align existing database enum values with application enum.
-- Prisma client now expects:
--   UNPAID (was PENDING)
--   REFUNDING (was REFUND_PENDING)
--   plus new value CANCELLED

-- 1) Rename existing enum values (keeps existing rows valid)
ALTER TYPE "OrderStatus" RENAME VALUE 'PENDING' TO 'UNPAID';
ALTER TYPE "OrderStatus" RENAME VALUE 'REFUND_PENDING' TO 'REFUNDING';

-- 2) Add new enum values (idempotent blocks for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus' AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';
  END IF;
END $$;

-- 3) Update default on Order.status if needed
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'UNPAID';


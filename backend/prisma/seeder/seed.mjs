/**
 * Production-safe seed (plain Node, no tsx). Used by Docker and `prisma db seed`.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PRODUCTS = [
  { sku: 'wireless-mouse', name: 'Wireless Mouse', stock: 100 },
  { sku: 'usb-c-cable', name: 'USB-C Cable', stock: 200 },
  { sku: 'laptop-stand', name: 'Laptop Stand', stock: 50 },
];

const DEMO_ORDER_IDEMPOTENCY_KEY = 'seed_demo_order_static';

async function seedProducts() {
  for (const product of DEMO_PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      create: {
        sku: product.sku,
        name: product.name,
        stock: product.stock,
        reservedStock: 0,
      },
      update: {
        name: product.name,
        stock: product.stock,
        reservedStock: 0,
      },
    });
  }
}

async function seedDemoOrder() {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: DEMO_ORDER_IDEMPOTENCY_KEY },
  });
  if (existing) return;

  await prisma.order.create({
    data: {
      amount: '12.50',
      currency: process.env.PAYPAL_CURRENCY ?? 'MYR',
      status: 'UNPAID',
      idempotencyKey: DEMO_ORDER_IDEMPOTENCY_KEY,
      externalRef: 'seed-demo',
    },
  });
}

async function main() {
  await seedProducts();
  await seedDemoOrder();
}

main()
  .then(() => {
    console.log('Seed finished');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

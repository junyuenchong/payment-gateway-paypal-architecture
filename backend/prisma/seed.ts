import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PRODUCTS = [
  { sku: 'wireless-mouse', name: 'Wireless Mouse', stock: 100 },
  { sku: 'usb-c-cable', name: 'USB-C Cable', stock: 200 },
  { sku: 'laptop-stand', name: 'Laptop Stand', stock: 50 },
] as const;

async function main(): Promise<void> {
  for (const product of DEMO_PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      create: product,
      update: { name: product.name },
    });
  }

  const key = 'seed_demo_order_static';
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: key },
  });
  if (!existing) {
    await prisma.order.create({
      data: {
        amount: '12.50',
        currency: process.env.PAYPAL_CURRENCY ?? 'MYR',
        status: 'UNPAID',
        idempotencyKey: key,
        externalRef: 'seed-demo',
      },
    });
  }
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

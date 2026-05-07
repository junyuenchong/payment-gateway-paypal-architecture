import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
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

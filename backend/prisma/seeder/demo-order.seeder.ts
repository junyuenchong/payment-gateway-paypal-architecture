import { prisma } from './prisma-client';

const DEMO_ORDER_IDEMPOTENCY_KEY = 'seed_demo_order_static';

export async function seedDemoOrder(): Promise<void> {
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

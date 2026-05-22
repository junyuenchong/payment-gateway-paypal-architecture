import { seedDemoOrder } from './demo-order.seeder';
import { prisma } from './prisma-client';
import { seedProducts } from './product.seeder';

async function main(): Promise<void> {
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

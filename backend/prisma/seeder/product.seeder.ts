import { prisma } from './prisma-client';

const DEMO_PRODUCTS = [
  { sku: 'wireless-mouse', name: 'Wireless Mouse', stock: 100 },
  { sku: 'usb-c-cable', name: 'USB-C Cable', stock: 200 },
  { sku: 'laptop-stand', name: 'Laptop Stand', stock: 50 },
] as const;

export async function seedProducts(): Promise<void> {
  for (const product of DEMO_PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      create: { ...product, reservedStock: 0 },
      update: {
        name: product.name,
        stock: product.stock,
        reservedStock: 0,
      },
    });
  }
}

import { BadRequestException } from '@nestjs/common';

/** ----- Enforce DB-aligned inventory rules after every mutation. ----- **/
export function assertProductInventoryInvariant(product: {
  sku: string;
  stock: number;
  reservedStock: number;
}): void {
  if (product.stock < 0) {
    throw new BadRequestException(
      `Inventory invariant: negative total_stock for ${product.sku}`,
    );
  }
  if (product.reservedStock < 0) {
    throw new BadRequestException(
      `Inventory invariant: negative reserved_stock for ${product.sku}`,
    );
  }
  if (product.reservedStock > product.stock) {
    throw new BadRequestException(
      `Inventory invariant: reserved_stock (${product.reservedStock}) > total_stock (${product.stock}) for ${product.sku}`,
    );
  }
}

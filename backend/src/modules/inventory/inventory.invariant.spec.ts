import { BadRequestException } from '@nestjs/common';

import { assertProductInventoryInvariant } from './inventory.invariant';

describe('assertProductInventoryInvariant', () => {
  it('accepts valid production snapshot (90 / 0 / 90)', () => {
    expect(() =>
      assertProductInventoryInvariant({
        sku: 'demo',
        stock: 90,
        reservedStock: 0,
      }),
    ).not.toThrow();
  });

  it('rejects negative total_stock', () => {
    expect(() =>
      assertProductInventoryInvariant({
        sku: 'demo',
        stock: -1,
        reservedStock: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects reserved_stock > total_stock', () => {
    expect(() =>
      assertProductInventoryInvariant({
        sku: 'demo',
        stock: 10,
        reservedStock: 11,
      }),
    ).toThrow(BadRequestException);
  });
});

import { buildReservationKey, sortSkusForLock } from './inventory.helper';

describe('inventory.helper', () => {
  it('sortSkusForLock orders lexicographically to prevent deadlock', () => {
    expect(sortSkusForLock(['zebra', 'apple', 'mango'])).toEqual([
      'apple',
      'mango',
      'zebra',
    ]);
  });

  it('buildReservationKey is stable per order and sku', () => {
    expect(buildReservationKey('ord_1', 'sku-a')).toBe('reserve:ord_1:sku-a');
  });
});

import {
  applyPaymentPending,
  applyPaymentSuccess,
  applyReleaseReservation,
  applyReserve,
  availableStock,
  toAvailabilityView,
} from './inventory.snapshot';

describe('ERP reserve stock flow (inventory.snapshot)', () => {
  const initial = { totalStock: 100, reservedStock: 0 };

  it('step 1 create order — reserve 10', () => {
    const after = applyReserve(initial, 10);
    expect(toAvailabilityView(after)).toEqual({
      totalStock: 100,
      reserved: 10,
      available: 90,
    });
  });

  it('step 2 payment pending — still reserved', () => {
    const reserved = applyReserve(initial, 10);
    const pending = applyPaymentPending(reserved);
    expect(pending).toEqual(reserved);
    expect(availableStock(pending)).toBe(90);
  });

  it('step 3 payment success — physical 90, reserved 0, available 90', () => {
    const reserved = applyReserve(initial, 10);
    const paid = applyPaymentSuccess(reserved, 10);
    expect(toAvailabilityView(paid)).toEqual({
      totalStock: 90,
      reserved: 0,
      available: 90,
    });
  });

  it('step 4 failed — release reservation, available returns to 100', () => {
    const reserved = applyReserve(initial, 10);
    const released = applyReleaseReservation(reserved, 10);
    expect(toAvailabilityView(released)).toEqual({
      totalStock: 100,
      reserved: 0,
      available: 100,
    });
  });

  it('full example table from payment success path', () => {
    const before = toAvailabilityView(applyReserve(initial, 10));
    expect(before).toMatchObject({
      totalStock: 100,
      reserved: 10,
      available: 90,
    });

    const after = toAvailabilityView(
      applyPaymentSuccess(applyReserve(initial, 10), 10),
    );
    expect(after).toMatchObject({
      totalStock: 90,
      reserved: 0,
      available: 90,
    });
  });
});

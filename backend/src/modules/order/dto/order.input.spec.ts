import { CreateOrderInputSchema } from './order.input';

describe('Order quantity validation', () => {
  it.each([
    undefined,
    [],
    [{ sku: 'sku', quantity: 0, unitPrice: 2 }],
    [{ sku: 'sku', quantity: 1.5, unitPrice: 2 }],
  ])('rejects invalid items %j', (items) => {
    expect(CreateOrderInputSchema.safeParse({ amount: 2, items }).success).toBe(
      false,
    );
  });
  it('accepts positive integer quantities', () => {
    expect(
      CreateOrderInputSchema.safeParse({
        amount: 4,
        items: [{ sku: 'sku', quantity: 2, unitPrice: 2 }],
      }).success,
    ).toBe(true);
  });
});

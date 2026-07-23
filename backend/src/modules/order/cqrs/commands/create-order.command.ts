export type CreateOrderLineItem = {
  sku: string;
  quantity: number;
  unitPrice: number;
};

/** ----- Handle create order command. ----- **/
export class CreateOrderCommand {
  /** ----- Create Order Command Payload ----- **/
  constructor(
    public readonly amount: number,
    public readonly currency: string | undefined,
    public readonly externalRef: string | undefined,
    public readonly items: CreateOrderLineItem[] | undefined,
    public readonly idempotencyKey: string | undefined,
  ) {}
}

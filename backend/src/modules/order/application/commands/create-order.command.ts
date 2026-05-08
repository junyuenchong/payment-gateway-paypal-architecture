/** ----- Handle creat rde ommand class ----- **/
export class CreateOrderCommand {
  /** ----- Create Order Command Payload ----- **/
  constructor(
    public readonly amount: number,
    public readonly currency: string | undefined,
    public readonly externalRef: string | undefined,
  ) {}
}

/** ----- Schedule Capture Payment Command ----- **/
export class ScheduleCapturePaymentCommand {
  /** ----- Handle constructor dependency wiring ----- **/
  constructor(public readonly orderId: string) {}
}

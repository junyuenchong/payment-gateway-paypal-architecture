/** ----- List reservation audit rows for an order. ----- **/
export class ListOrderReservationsQuery {
  constructor(public readonly orderId: string) {}
}

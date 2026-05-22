/** ----- Expire ACTIVE reservations past expiresAt. ----- **/
export class ExpireStaleReservationsCommand {
  constructor(public readonly cutoff: Date = new Date()) {}
}

/** ----- Build deterministic reservation idempotency key per order line. ----- **/
export function buildReservationKey(orderId: string, sku: string): string {
  return `reserve:${orderId}:${sku}`;
}

/** ----- Sort SKUs to avoid multi-SKU deadlock (Amazon-style lock ordering). ----- **/
export function sortSkusForLock(skus: string[]): string[] {
  return [...skus].sort((a, b) => a.localeCompare(b));
}

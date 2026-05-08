/** ----- Define payment provider constants ----- **/
export const PAYMENT_PROVIDER = {
  PAYPAL: 'paypal',
  MOCK: 'mock',
} as const;

/** ----- Define payment provider type ----- **/
export type PaymentProvider =
  (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];

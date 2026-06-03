/** ----- External event providers stored on ProcessedEvent. ----- **/
export const PROCESSED_EVENT_PROVIDER = {
  PAYPAL: 'paypal',
  MOCK: 'mock',
} as const;

export type ProcessedEventProvider =
  (typeof PROCESSED_EVENT_PROVIDER)[keyof typeof PROCESSED_EVENT_PROVIDER];

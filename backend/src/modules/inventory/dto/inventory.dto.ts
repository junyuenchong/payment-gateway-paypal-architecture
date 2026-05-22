/** ----- Product availability API response. ----- **/
export type ProductAvailabilityDto = {
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  available: number;
  version: number;
  updatedAt: string;
};

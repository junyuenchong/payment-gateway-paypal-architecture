/** ----- Product availability API response. ----- **/
export type OrderReservationAuditDto = {
  id: string;
  orderId: string;
  productId: string | null;
  sku: string;
  quantity: number;
  status: string;
  reservationKey: string;
  expiresAt: string;
  reservedAt: string;
  confirmedAt: string | null;
  fulfilledAt: string | null;
  releasedAt: string | null;
  expiredAt: string | null;
  restockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductAvailabilityDto = {
  sku: string;
  name: string;
  /** Physical on-hand (`Product.stock` / total_stock) */
  totalStock: number;
  /** @deprecated Use totalStock — kept for backward compatibility */
  onHand: number;
  reserved: number;
  available: number;
  version: number;
  updatedAt: string;
};

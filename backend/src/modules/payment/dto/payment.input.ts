/** ----- Payments - Input Types ----- **/
export type CreateCheckoutOrderInput = {
  internalOrderId: string;
  amount: string;
  currency: string;
};

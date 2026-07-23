/** ----- Payments - DTOs (Responses) ----- **/
export type CreateCheckoutOrderResultDto = {
  paypalOrderId: string;
  approvalUrl: string | null;
};

export type CaptureCheckoutOrderResultDto = {
  success: boolean;
};

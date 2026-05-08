/** ----- Payments - DTOs (Responses) ----- **/
export type CreateCheckoutOrderResultDto = {
  paypalOrderId: string;
  approvalUrl: string;
};

export type CaptureCheckoutOrderResultDto = {
  success: boolean;
};

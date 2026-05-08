/** ----- Webhooks - Input Types ----- **/
export type PayPalWebhookHeadersInput = {
  mockSignature?: string;
  paypalTransmissionId?: string;
  paypalTransmissionTime?: string;
  paypalTransmissionSig?: string;
  paypalCertUrl?: string;
  paypalAuthAlgo?: string;
};

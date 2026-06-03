export type WebhookAuthHeaders = {
  mockSig?: string;
  paypalTransmissionId?: string;
  paypalTransmissionTime?: string;
  paypalTransmissionSig?: string;
  paypalCertUrl?: string;
  paypalAuthAlgo?: string;
};

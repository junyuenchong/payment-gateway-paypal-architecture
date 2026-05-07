/**
 * ------------------------------------------------------
 * Mock Payment Queue Definitions
 * ------------------------------------------------------
 */
export const MOCK_PAYMENT_QUEUE = 'mock-payment-queue';
export const MOCK_CAPTURE_SUCCESS_JOB = 'mock-capture-success';

export type MockCaptureSuccessJobData = {
  internalOrderId: string;
  paypalOrderId: string;
};

'use client';

import { useCallback, useState } from 'react';
import type { PaymentIntentResponse } from '../types';
import { createPaymentIntent } from '../services/payment.service';
import { toErrorMessage } from '../../shared/lib/error';

/**
 * ------------------------------------------------------
 * Use Payment Hook
 * ------------------------------------------------------
 */
export function usePayment() {
  const [result, setResult] = useState<PaymentIntentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const requestPaymentIntent = useCallback(async (orderId: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await createPaymentIntent(orderId);
      setResult(response);
      return response;
    } catch (err) {
      setError(toErrorMessage(err, 'Payment request failed'));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, requestPaymentIntent };
}

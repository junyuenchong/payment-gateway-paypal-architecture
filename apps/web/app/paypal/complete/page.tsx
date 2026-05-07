'use client';

import { useEffect, useState } from 'react';
import { env } from '../../../features/shared/lib/env';

/**
 * ------------------------------------------------------
 * PayPal Complete Callback Page
 * ------------------------------------------------------
 */
export default function PayPalCompletePage() {
  const [orderId, setOrderId] = useState('N/A');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedOrderId = params.get('orderId') ?? 'N/A';
    setOrderId(parsedOrderId);

    if (parsedOrderId && parsedOrderId !== 'N/A') {
      // When opened in a new tab (popup blocked), there is no opener to notify.
      // Do a best-effort capture here so the original page's polling can update to PAID.
      void fetch(`${env.apiBaseUrl}/orders/${parsedOrderId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        // Ignore: capture might already be done or not ready yet.
      });
    }

    const openerWindow = window.opener as Window | null;
    if (openerWindow && !openerWindow.closed) {
      openerWindow.postMessage(
        { type: 'paypal-complete', orderId: parsedOrderId },
        '*',
      );
    }
    window.setTimeout(() => {
      window.close();
    }, 3500);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-[92%] max-w-xl items-center justify-center py-10 text-slate-200">
      <section className="w-full rounded-2xl border border-slate-700/80 bg-slate-900/70 p-6 backdrop-blur-sm">
        <p className="inline-block rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold tracking-wide text-emerald-100">
          PayPal Completed
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Payment approved</h1>
        <p className="mt-2 text-sm text-emerald-300">Status: APPROVED</p>
        <p className="mt-2 text-slate-300">
          Callback sent to main window. This window will close in a few seconds.
        </p>
        <p className="mt-4 text-sm text-slate-400">Order ID: {orderId}</p>
      </section>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';

/**
 * ------------------------------------------------------
 * PayPal Cancelled Callback Page
 * ------------------------------------------------------
 */
export default function PayPalCancelledPage() {
  const [orderId, setOrderId] = useState('N/A');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsedOrderId = params.get('orderId') ?? 'N/A';
    setOrderId(parsedOrderId);

    const openerWindow = window.opener as Window | null;
    if (openerWindow && !openerWindow.closed) {
      openerWindow.postMessage(
        { type: 'paypal-cancelled', orderId: parsedOrderId },
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
        <p className="inline-block rounded-full bg-amber-700 px-3 py-1 text-xs font-bold tracking-wide text-amber-100">
          PayPal Cancelled
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Payment was cancelled</h1>
        <p className="mt-2 text-sm text-amber-300">Status: CANCELLED</p>
        <p className="mt-2 text-slate-300">
          Callback sent to main window. This window will close in a few seconds.
        </p>
        <p className="mt-4 text-sm text-slate-400">Order ID: {orderId}</p>
      </section>
    </main>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton } from '../features/payment/components/ui/action-button';
import { PaymentHistoryTable } from '../features/payment/components/payment-history-table';
import { StatusCard } from '../features/payment/components/ui/status-card';
import { uiTokens } from '../features/shared/lib/ui-tokens';
import { useOrdersHistory } from '../features/payment/hooks/use-orders-history';
import type { PaymentRow } from '../features/payment/hooks/use-orders-history';
import { usePayment } from '../features/payment/hooks/use-payment';
import {
  capturePayment,
  createOrder,
  getOrderStatus,
} from '../features/payment/services/payment.service';
import { toErrorMessage } from '../features/shared/lib/error';

/**
 * ------------------------------------------------------
 * Checkout Page Models & Constants
 * ------------------------------------------------------
 */
type CheckoutItem = {
  id: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
};

const INITIAL_ITEMS: CheckoutItem[] = [
  {
    id: 'i1',
    sku: 'wireless-mouse',
    name: 'Wireless Mouse',
    qty: 1,
    unitPrice: 39.9,
  },
  { id: 'i2', sku: 'usb-c-cable', name: 'USB-C Cable', qty: 2, unitPrice: 12.5 },
  {
    id: 'i3',
    sku: 'laptop-stand',
    name: 'Laptop Stand',
    qty: 1,
    unitPrice: 49.9,
  },
];
const SUPPORTED_CURRENCIES = (
  process.env.NEXT_PUBLIC_PAYPAL_SUPPORTED_CURRENCIES ?? 'MYR'
)
  .split(',')
  .map((currency) => currency.trim().toUpperCase())
  .filter((currency) => currency.length > 0);
const FALLBACK_CURRENCY = SUPPORTED_CURRENCIES[0] ?? 'MYR';

export default function HomePage() {
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const { loading, error, requestPaymentIntent } = usePayment();
  const [checkoutError, setCheckoutError] = useState<string | undefined>();
  const [payingAgainOrderId, setPayingAgainOrderId] = useState<string | null>(
    null,
  );
  const [items, setItems] = useState<CheckoutItem[]>(INITIAL_ITEMS);
  const [selectedCurrency, setSelectedCurrency] = useState(FALLBACK_CURRENCY);
  const {
    paymentRows,
    setPaymentRows,
    hasMoreOrders,
    loadingMoreOrders,
    ordersError,
    loadMoreOrders,
  } = useOrdersHistory();
  const popupWatcherRef = useRef<number | null>(null);
  const statusPollerRef = useRef<number | null>(null);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [paypalCheckoutUrl, setPaypalCheckoutUrl] = useState<string | null>(
    null,
  );
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [gatewayMode, setGatewayMode] = useState<'idle' | 'paypal' | 'mock'>(
    'idle',
  );

  const totalAmount = useMemo(
    () =>
      Number(
        items
          .reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
          .toFixed(2),
      ),
    [items],
  );

  /**
   * ------------------------------------------------------
   * Update Item Quantity
   * ------------------------------------------------------
   */
  const changeQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item,
      ),
    );
  };

  /**
   * ------------------------------------------------------
   * Upsert Payment Table Row
   * ------------------------------------------------------
   */
  const upsertPaymentRow = (
    next: Partial<PaymentRow> & { orderId: string },
  ) => {
    setPaymentRows((prev) => {
      const existing = prev.find((row) => row.orderId === next.orderId);
      if (!existing) {
        return [
          {
            orderId: next.orderId,
            provider: next.provider ?? '-',
            currency: next.currency ?? selectedCurrency,
            amount: next.amount ?? totalAmount,
            intentStatus: next.intentStatus ?? 'UNPAID',
            liveStatus: next.liveStatus ?? 'UNPAID',
            updatedAt: new Date().toLocaleTimeString(),
          },
          ...prev,
        ];
      }
      return prev.map((row) =>
        row.orderId === next.orderId
          ? {
              ...row,
              ...next,
              updatedAt: new Date().toLocaleTimeString(),
            }
          : row,
      );
    });
  };

  /**
   * ------------------------------------------------------
   * Sync Order Status To Table
   * ------------------------------------------------------
   */
  const setOrderStatusFromApi = (orderId: string, status: string) => {
    upsertPaymentRow({
      orderId,
      liveStatus: status,
      intentStatus: status,
    });
    if (status === 'PAID' || status === 'FAILED' || status === 'CANCELLED') {
      setCreatedOrderId(null);
      setGatewayMode('idle');
      setPaypalCheckoutUrl(null);
      setPopupBlocked(false);
    }
  };

  /**
   * ------------------------------------------------------
   * Start Order Status Polling
   * ------------------------------------------------------
   */
  const startStatusPolling = (orderId: string, maxMs = 90000) => {
    if (statusPollerRef.current) {
      window.clearInterval(statusPollerRef.current);
      statusPollerRef.current = null;
    }

    const start = Date.now();
    statusPollerRef.current = window.setInterval(() => {
      void getOrderStatus(orderId)
        .then((latest) => {
          setOrderStatusFromApi(orderId, latest.status);
          const terminal =
            latest.status === 'PAID' ||
            latest.status === 'FAILED' ||
            latest.status === 'REFUNDED' ||
            latest.status === 'PARTIALLY_REFUNDED';
          const timeout = Date.now() - start > maxMs;
          if (terminal || timeout) {
            if (statusPollerRef.current) {
              window.clearInterval(statusPollerRef.current);
              statusPollerRef.current = null;
            }
          }
        })
        .catch(() => {
          // Ignore transient polling errors.
        });
    }, 2000);
  };

  /**
   * ------------------------------------------------------
   * Wait for PayPal approvalUrl to be generated.
   * (Needed because create-payment-intent is now queue-based.)
   * ------------------------------------------------------
   */
  const waitForApprovalUrl = async (
    orderId: string,
    maxMs = 90000,
  ): Promise<string> => {
    const start = Date.now();
    while (Date.now() - start <= maxMs) {
      const latest = await getOrderStatus(orderId);
      setOrderStatusFromApi(orderId, latest.status);
      if (latest.approvalUrl) return latest.approvalUrl;
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    throw new Error('Timed out waiting for checkout approvalUrl');
  };

  /**
   * ------------------------------------------------------
   * Open PayPal Approval Window
   * ------------------------------------------------------
   */
  const openPaypalPopup = (
    approvalUrl: string,
    orderId: string,
  ): boolean => {
    setPaypalCheckoutUrl(approvalUrl);
    const popupWidth = 520;
    const popupHeight = 720;
    const left = Math.max(0, (window.screen.width - popupWidth) / 2);
    const top = Math.max(0, (window.screen.height - popupHeight) / 2);
    const features = [
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${Math.floor(left)}`,
      `top=${Math.floor(top)}`,
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');

    const popup = window.open(approvalUrl, 'paypalCheckout', features);
    if (!popup) {
      setPopupBlocked(true);
      startStatusPolling(orderId);
      return false;
    }

    setPopupBlocked(false);
    if (popupWatcherRef.current) {
      window.clearInterval(popupWatcherRef.current);
    }
    if (statusPollerRef.current) {
      window.clearInterval(statusPollerRef.current);
    }
    startStatusPolling(orderId);
    popupWatcherRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      if (popupWatcherRef.current) {
        window.clearInterval(popupWatcherRef.current);
        popupWatcherRef.current = null;
      }
    }, 700);
    return true;
  };

  /**
   * ------------------------------------------------------
   * Continue Payment Flow
   * ------------------------------------------------------
   */
  const continuePaymentFlow = (
    orderId: string,
    intent: { provider: string; status: string; approvalUrl: string | null },
  ) => {
    upsertPaymentRow({
      orderId,
      provider: intent.provider,
      intentStatus: intent.status,
      liveStatus: intent.status,
    });

    void (async () => {
      setOpeningCheckout(true);
      setPaypalCheckoutUrl(null);
      setPopupBlocked(false);
      setGatewayMode('idle');
      try {
        if (intent.provider === 'MOCK') {
          setGatewayMode('mock');
          startStatusPolling(orderId);
          return;
        }

        if (intent.provider === 'PAYPAL') {
          setGatewayMode('paypal');
          const approvalUrl = intent.approvalUrl
            ? intent.approvalUrl
            : await waitForApprovalUrl(orderId);

          const opened = openPaypalPopup(approvalUrl, orderId);
          if (!opened) {
            setCheckoutError(
              'PayPal popup was blocked. Use the link below to open checkout.',
            );
          }
        }
      } catch (err) {
        setCheckoutError(
          toErrorMessage(err, 'Unable to create PayPal checkout URL'),
        );
        startStatusPolling(orderId);
      } finally {
        setOpeningCheckout(false);
      }
    })();
  };

  /**
   * ------------------------------------------------------
   * Request Payment Intent And Continue
   * ------------------------------------------------------
   */
  const requestAndContinuePayment = async (orderId: string) => {
    const intent = await requestPaymentIntent(orderId);
    if (!intent) {
      setCheckoutError('Unable to start payment. Check that the backend API is reachable.');
      return false;
    }
    setCreatedOrderId(orderId);
    continuePaymentFlow(orderId, intent);
    return true;
  };

  /**
   * ------------------------------------------------------
   * Handle PayPal Completion Callback
   * ------------------------------------------------------
   */
  const handlePaymentCompleted = (orderId: string) => {
    setCreatedOrderId(orderId);
    // Try capture as a fallback when webhooks aren't reachable locally.
    void capturePayment(orderId).catch(() => {
      // Ignore capture errors; status polling/webhook can still finalize.
    });
    startStatusPolling(orderId);
    void getOrderStatus(orderId)
      .then((order) => {
        setOrderStatusFromApi(orderId, order.status);
      })
      .catch(() => {
        // Ignore refresh errors for callback event.
      });
  };

  /**
   * ------------------------------------------------------
   * Handle Pay Again Action
   * ------------------------------------------------------
   */
  const handlePayAgain = async (orderId: string) => {
    setCheckoutError(undefined);
    setPayingAgainOrderId(orderId);
    try {
      await requestAndContinuePayment(orderId);
    } catch (err) {
      setCheckoutError(toErrorMessage(err, 'Unable to restart payment'));
    } finally {
      setPayingAgainOrderId(null);
    }
  };

  useEffect(() => {
    const isTrustedPayPalCallbackOrigin = (origin: string): boolean => {
      try {
        const a = new URL(origin);
        const b = new URL(window.location.origin);
        const sameProtocol = a.protocol === b.protocol;
        const samePort =
          (a.port || (a.protocol === 'https:' ? '443' : '80')) ===
          (b.port || (b.protocol === 'https:' ? '443' : '80'));
        const localHosts = new Set(['localhost', '127.0.0.1']);
        const bothLocal =
          localHosts.has(a.hostname) && localHosts.has(b.hostname);
        return sameProtocol && samePort && bothLocal;
      } catch {
        return false;
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin &&
        !isTrustedPayPalCallbackOrigin(event.origin)
      ) {
        return;
      }
      const payload = event.data as
        | { type?: string; orderId?: string }
        | undefined;
      if (!payload?.type) return;

      if (payload.type === 'paypal-complete') {
        if (!payload.orderId) return;
        handlePaymentCompleted(payload.orderId);
      }

      if (payload.type === 'paypal-cancelled') {
        if (payload.orderId) {
          upsertPaymentRow({
            orderId: payload.orderId,
            liveStatus: 'CANCELLED',
            intentStatus: 'CANCELLED',
          });
          setCreatedOrderId(null);
          if (statusPollerRef.current) {
            window.clearInterval(statusPollerRef.current);
            statusPollerRef.current = null;
          }
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (popupWatcherRef.current) {
        window.clearInterval(popupWatcherRef.current);
      }
      if (statusPollerRef.current) {
        window.clearInterval(statusPollerRef.current);
      }
    };
  }, []);

  /**
   * ------------------------------------------------------
   * Handle Checkout Button Action
   * ------------------------------------------------------
   */
  const handlePaypalMockCheckout = async () => {
    setCheckoutError(undefined);
    setPaypalCheckoutUrl(null);
    setPopupBlocked(false);
    try {
      const order = await createOrder({
        amount: totalAmount,
        currency: selectedCurrency,
        externalRef: `web-${Date.now()}`,
        items: items.map((item) => ({
          sku: item.sku,
          quantity: item.qty,
          unitPrice: item.unitPrice,
        })),
      });
      setCreatedOrderId(order.id);
      upsertPaymentRow({
        orderId: order.id,
        provider: 'PAYPAL',
        currency: selectedCurrency,
        amount: totalAmount,
        intentStatus: 'UNPAID',
        liveStatus: 'UNPAID',
      });
      await requestAndContinuePayment(order.id);
    } catch (err) {
      setCheckoutError(toErrorMessage(err, 'Unable to start payment'));
    }
  };

  /**
   * ------------------------------------------------------
   * Handle Manual Status Refresh
   * ------------------------------------------------------
   */
  const handleRefreshStatus = async () => {
    if (!createdOrderId) return;
    setCheckoutError(undefined);
    try {
      const order = await getOrderStatus(createdOrderId);
      setOrderStatusFromApi(createdOrderId, order.status);
    } catch (err) {
      setCheckoutError(toErrorMessage(err, 'Unable to refresh status'));
    }
  };

  return (
    <main className={uiTokens.layoutShell}>
      <section className={uiTokens.sectionCard}>
        <p className="inline-block rounded-full bg-blue-700 px-4 py-1.5 text-base font-bold tracking-wide text-blue-100">
          PayPal Checkout
        </p>
        <h1 className={uiTokens.sectionTitle}>One-Page Payment</h1>
        <p className={uiTokens.sectionSubtitle}>
          Review items and pay with PayPal.
        </p>

        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div key={item.id} className={uiTokens.listCardItem}>
              <div>
                <p className="font-medium">{item.name}</p>
                <div className="mt-2 flex items-center gap-3 text-base text-slate-400">
                  <button
                    type="button"
                    onClick={() => changeQty(item.id, -1)}
                    className="h-9 w-9 rounded-lg border border-slate-600 bg-slate-700 text-lg font-semibold text-slate-100"
                  >
                    -
                  </button>
                  <span>Qty: {item.qty}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(item.id, 1)}
                    className="h-9 w-9 rounded-lg border border-slate-600 bg-slate-700 text-lg font-semibold text-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-right font-semibold sm:text-left">
                {selectedCurrency} {(item.qty * item.unitPrice).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label
            htmlFor="currency"
            className="mb-1 block text-sm font-medium text-slate-300"
          >
            Currency
          </label>
          <select
            id="currency"
            value={selectedCurrency}
            onChange={(event) => {
              setSelectedCurrency(event.target.value);
            }}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>

        <div
          className={`mt-5 flex items-center justify-between rounded-lg px-4 py-3 ${uiTokens.totalAmountCard}`}
        >
          <p className="text-xl font-semibold">Total Amount</p>
          <p
            className={`text-right text-xl font-extrabold sm:text-2xl ${uiTokens.totalAmountValue}`}
          >
            {selectedCurrency} {totalAmount.toFixed(2)}
          </p>
        </div>

        <div className="mt-5">
          <ActionButton
            onClick={() => {
              void handlePaypalMockCheckout();
            }}
            disabled={loading || openingCheckout}
          >
            {loading || openingCheckout
              ? 'Opening PayPal...'
              : 'Pay with PayPal'}
          </ActionButton>
        </div>

        {openingCheckout ? (
          <div className="mt-4">
            <StatusCard
              title="PayPal Checkout"
              status="Preparing gateway..."
              statusClassName="text-amber-300"
              description="Creating your PayPal session. This usually takes a few seconds."
            />
          </div>
        ) : null}

        {gatewayMode === 'mock' ? (
          <div className="mt-4">
            <StatusCard
              title="Mock Payment Gateway"
              status="Processing (no PayPal UI)"
              statusClassName="text-sky-300"
              description="MOCK_PAYMENT_GATEWAY is enabled on the backend. Payment completes via a simulated webhook."
            />
          </div>
        ) : null}

        {paypalCheckoutUrl ? (
          <div className="mt-4 rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm text-slate-200">
            <p className="font-medium text-slate-100">PayPal checkout</p>
            {popupBlocked ? (
              <p className="mt-1 text-slate-400">
                Your browser blocked the popup window.
              </p>
            ) : null}
            <a
              href={paypalCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-semibold text-blue-400 underline hover:text-blue-300"
            >
              Open PayPal to complete payment
            </a>
          </div>
        ) : null}

        {createdOrderId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              onClick={() => {
                void handleRefreshStatus();
              }}
              disabled={loading}
            >
              Refresh Order Status
            </ActionButton>
          </div>
        ) : null}

        {checkoutError ? (
          <p className="mt-3 text-sm text-rose-400">{checkoutError}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        {ordersError ? (
          <p className="mt-3 text-sm text-rose-400">{ordersError}</p>
        ) : null}

        <PaymentHistoryTable
          rows={paymentRows}
          hasMoreOrders={hasMoreOrders}
          loadingMoreOrders={loadingMoreOrders}
          onLoadMore={() => {
            void loadMoreOrders();
          }}
          onPayAgain={(orderId) => {
            void handlePayAgain(orderId);
          }}
          payingOrderId={payingAgainOrderId}
        />
      </section>
    </main>
  );
}

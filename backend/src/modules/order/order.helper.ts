/** ----- Normalize positive number with fallback. ----- **/
export function normalizePositiveNumber(
  value: unknown,
  fallback: number,
): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** ----- Check whether capture error means already captured. ----- **/
export function isAlreadyCapturedError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  return (
    message.includes('order already captured') ||
    message.includes('already captured') ||
    message.includes('only one capture per order is allowed')
  );
}

/** ----- Build order list page payload. ----- **/
export function buildOrderListPage(params: {
  orders: Array<{
    id: string;
    amount: { toString(): string };
    currency: string;
    status: string;
    paypalOrderId: string | null;
    updatedAt: Date;
  }>;
  limit: number;
  direction: 'asc' | 'desc';
}) {
  const hasMore = params.orders.length > params.limit;
  const pageItems = hasMore
    ? params.orders.slice(0, params.limit)
    : params.orders;
  const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id : null;

  return {
    data: pageItems.map((order) => ({
      id: order.id,
      amount: order.amount.toString(),
      currency: order.currency,
      status: order.status,
      paypalOrderId: order.paypalOrderId,
      updatedAt: order.updatedAt.toISOString(),
    })),
    pageInfo: {
      nextCursor,
      hasMore,
      limit: params.limit,
      direction: params.direction,
    },
  };
}

/** ----- Build order events page payload. ----- **/
export function buildOrderEventsPage(params: {
  order: {
    amount: { toString(): string };
    webhookEvents: Array<{
      id: string;
      eventId: string;
      type: string;
      status: string;
      createdAt: Date;
    }>;
  } & Record<string, unknown>;
  eventsLimit: number;
  eventsDirection: 'asc' | 'desc';
}) {
  const hasMoreEvents = params.order.webhookEvents.length > params.eventsLimit;
  const webhookEvents = hasMoreEvents
    ? params.order.webhookEvents.slice(0, params.eventsLimit)
    : params.order.webhookEvents;
  const nextEventsCursor = hasMoreEvents
    ? webhookEvents[webhookEvents.length - 1]?.id
    : null;

  return {
    ...params.order,
    webhookEvents,
    webhookEventsPageInfo: {
      nextCursor: nextEventsCursor,
      hasMore: hasMoreEvents,
      limit: params.eventsLimit,
      direction: params.eventsDirection,
    },
    amount: params.order.amount.toString(),
  };
}

import { WebhookService } from './webhook.service';
import { assertValidWebhookSignature } from './helpers/webhook.helper';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
jest.mock('./helpers/webhook.helper', () => ({
  assertValidWebhookSignature: jest.fn(),
}));

describe('Webhook idempotency', () => {
  const setup = () => {
    const idempotency = {
      findProcessedExternalEvent: jest.fn(),
      findWebhookByExternalEventId: jest.fn(),
      recordWebhookAndMarkProcessed: jest.fn(),
    };
    const queue = { processWebhook: jest.fn() };
    const locks = {
      tryAcquire: jest.fn().mockResolvedValue('lock'),
      release: jest.fn(),
    };
    const rowLocks = {
      findWebhookEventStatus: jest
        .fn()
        .mockResolvedValue([{ status: 'PROCESSED' }]),
      findOrderIdAndStatus: jest.fn(),
    };
    const tx = {
      order: { update: jest.fn() },
      webhookEvent: { update: jest.fn() },
    };
    const inventory = { commitForOrder: jest.fn() };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const service = new WebhookService(
      {} as never,
      {} as never,
      prisma as never,
      rowLocks as never,
      inventory as never,
      idempotency as never,
      queue as never,
      locks as never,
    );
    return {
      service,
      idempotency,
      queue,
      locks,
      rowLocks,
      tx,
      inventory,
      prisma,
    };
  };
  const request = {
    rawBody: Buffer.from(
      JSON.stringify({ id: 'evt-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' }),
    ),
    headers: {},
  };
  beforeEach(() =>
    jest.mocked(assertValidWebhookSignature).mockResolvedValue(undefined),
  );
  it('requests retry when another delivery is still being ingested', async () => {
    const { service, locks, idempotency } = setup();
    locks.tryAcquire.mockResolvedValue(null);
    await expect(service.receivePayPalWebhook(request)).rejects.toThrow(
      'retry delivery',
    );
    expect(idempotency.recordWebhookAndMarkProcessed).not.toHaveBeenCalled();
  });
  it('requeues a pending duplicate after an enqueue failure', async () => {
    const { service, idempotency, queue } = setup();
    idempotency.findProcessedExternalEvent.mockResolvedValue({
      eventId: 'evt-1',
    });
    idempotency.findWebhookByExternalEventId.mockResolvedValue({
      id: 'row-1',
      status: 'RECEIVED',
    });
    await expect(service.receivePayPalWebhook(request)).resolves.toEqual({
      duplicate: true,
    });
    expect(queue.processWebhook).toHaveBeenCalledWith('row-1');
    expect(idempotency.recordWebhookAndMarkProcessed).not.toHaveBeenCalled();
  });
  it('recovers a pending event after a unique constraint race', async () => {
    const { service, idempotency, queue } = setup();
    idempotency.recordWebhookAndMarkProcessed.mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5',
      }),
    );
    idempotency.findWebhookByExternalEventId.mockResolvedValue({
      id: 'row-1',
      status: 'RECEIVED',
    });
    await expect(service.receivePayPalWebhook(request)).resolves.toEqual({
      duplicate: true,
    });
    expect(queue.processWebhook).toHaveBeenCalledWith('row-1');
  });
  it('does not apply a processed event twice under the database lock', async () => {
    const { service, rowLocks, tx } = setup();
    await service.processWebhookEventState({
      webhookEventId: 'row-1',
      rowId: 'row-1',
      orderId: 'order-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      resourceStatus: 'COMPLETED',
    });
    expect(rowLocks.findOrderIdAndStatus).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
  it('uses one transaction for inventory, order, and webhook completion', async () => {
    const { service, rowLocks, tx, inventory, prisma } = setup();
    rowLocks.findWebhookEventStatus.mockResolvedValue([{ status: 'RECEIVED' }]);
    rowLocks.findOrderIdAndStatus.mockResolvedValue([{ status: 'PROCESSING' }]);
    await service.processWebhookEventState({
      webhookEventId: 'row-1',
      rowId: 'row-1',
      orderId: 'order-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      resourceStatus: 'COMPLETED',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(rowLocks.findWebhookEventStatus).toHaveBeenCalledWith(tx, 'row-1');
    expect(rowLocks.findOrderIdAndStatus).toHaveBeenCalledWith(tx, 'order-1');
    expect(inventory.commitForOrder).toHaveBeenCalledWith('order-1', tx);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'PAID' },
    });
    expect(tx.webhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSED' }) as unknown,
      }),
    );
  });
  it('propagates inventory failure out of the transaction without marking payment complete', async () => {
    const { service, rowLocks, tx, inventory } = setup();
    rowLocks.findWebhookEventStatus.mockResolvedValue([{ status: 'RECEIVED' }]);
    rowLocks.findOrderIdAndStatus.mockResolvedValue([{ status: 'PROCESSING' }]);
    inventory.commitForOrder.mockRejectedValue(
      new Error('Stock update failed'),
    );
    await expect(
      service.processWebhookEventState({
        webhookEventId: 'row-1',
        rowId: 'row-1',
        orderId: 'order-1',
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        resourceStatus: 'COMPLETED',
      }),
    ).rejects.toThrow('Stock update failed');
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.webhookEvent.update).not.toHaveBeenCalled();
  });
});

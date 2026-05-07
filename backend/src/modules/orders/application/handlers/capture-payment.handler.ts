import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { PayPalService } from '../../../payments/paypal.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderStatus } from '../../order-status';
import type { OrderStatusCode } from '../../order-status';
import {
  CapturePaymentCommand,
  CapturePaymentResult,
} from '../commands/capture-payment.command';

@CommandHandler(CapturePaymentCommand)
export class CapturePaymentHandler implements ICommandHandler<
  CapturePaymentCommand,
  CapturePaymentResult
> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payPal: PayPalService,
  ) {}

  /**
   * ------------------------------------------------------
   * Capture Order Payment
   * ------------------------------------------------------
   */
  async execute(command: CapturePaymentCommand): Promise<CapturePaymentResult> {
    const locked = await this.prisma.$transaction(async (tx) => {
      const orderRows = (await tx.$queryRaw<
        Array<{ id: string; status: string; paypalOrderId: string | null }>
      >`
        SELECT id, status, "paypalOrderId"
        FROM "Order"
        WHERE id = ${command.orderId}
        FOR UPDATE
      `) as Array<{
        id: string;
        status: string;
        paypalOrderId: string | null;
      }>;

      if (orderRows.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const order = orderRows[0];
      const status = order.status as OrderStatusCode;

      if (!order.paypalOrderId) {
        throw new BadRequestException('Order has no PayPal order id');
      }

      if (status === OrderStatus.PAID) {
        return {
          orderId: order.id,
          paypalOrderId: order.paypalOrderId,
          status: OrderStatus.PAID as OrderStatusCode,
          shouldCapture: false,
          message: 'Order already paid.',
        };
      }
      if (status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order cancelled; cannot capture');
      }

      // Mark PROCESSING early to prevent double capture when retries overlap.
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCESSING },
      });

      return {
        orderId: order.id,
        paypalOrderId: order.paypalOrderId,
        status: OrderStatus.PROCESSING as OrderStatusCode,
        shouldCapture: true,
        message: 'Capture started.',
      };
    });

    if (!locked.shouldCapture) {
      return {
        orderId: locked.orderId,
        status: locked.status,
        paypalOrderId: locked.paypalOrderId,
        message: locked.message,
      };
    }

    let nextStatus: typeof OrderStatus.PAID | typeof OrderStatus.FAILED;
    let captureSucceeded = false;
    try {
      const captured = await this.payPal.captureCheckoutOrder(
        locked.paypalOrderId,
      );
      captureSucceeded = captured.success;
      nextStatus = captured.success ? OrderStatus.PAID : OrderStatus.FAILED;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);
      const alreadyCaptured =
        message.includes('order already captured') ||
        message.includes('already captured') ||
        message.includes('only one capture per order is allowed');
      if (!alreadyCaptured) {
        throw error;
      }
      nextStatus = OrderStatus.PAID;
      captureSucceeded = true;
    }

    await this.prisma.$transaction(async (tx) => {
      const orderRows = (await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM "Order"
        WHERE id = ${command.orderId}
        FOR UPDATE
      `) as Array<{ id: string; status: string }>;

      if (orderRows.length === 0) {
        // Extremely unlikely; ignore and let outer retries handle.
        return;
      }

      // If another worker already flipped to PAID, keep it as PAID.
      if (orderRows[0].status === OrderStatus.PAID) return;

      await tx.order.update({
        where: { id: command.orderId },
        data: { status: nextStatus },
      });
    });

    return {
      orderId: locked.orderId,
      status: nextStatus as OrderStatusCode,
      paypalOrderId: locked.paypalOrderId,
      message: captureSucceeded
        ? 'Payment captured successfully.'
        : 'Payment capture failed.',
    };
  }
}

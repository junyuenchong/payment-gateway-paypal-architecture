import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PrismaService } from '../../../prisma/prisma.service';
import { GetOrderQuery } from '../queries/get-order.query';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery> {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ------------------------------------------------------
   * Get Order Details (With Event Pagination)
   * ------------------------------------------------------
   */
  async execute(query: GetOrderQuery) {
    const eventsTake = query.eventsLimit + 1;
    const order = await this.prisma.order.findUnique({
      where: { id: query.id },
      include: {
        webhookEvents: {
          cursor: query.eventsCursor ? { id: query.eventsCursor } : undefined,
          skip: query.eventsCursor ? 1 : 0,
          orderBy: [
            { createdAt: query.eventsDirection },
            { id: query.eventsDirection },
          ],
          take: eventsTake,
          select: {
            id: true,
            eventId: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const hasMoreEvents = order.webhookEvents.length > query.eventsLimit;
    const webhookEvents = hasMoreEvents
      ? order.webhookEvents.slice(0, query.eventsLimit)
      : order.webhookEvents;
    const nextEventsCursor = hasMoreEvents
      ? webhookEvents[webhookEvents.length - 1]?.id
      : null;

    return {
      ...order,
      webhookEvents,
      webhookEventsPageInfo: {
        nextCursor: nextEventsCursor,
        hasMore: hasMoreEvents,
        limit: query.eventsLimit,
        direction: query.eventsDirection,
      },
      amount: order.amount.toString(),
    };
  }
}

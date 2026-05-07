import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PrismaService } from '../../../prisma/prisma.service';
import { ListOrdersQuery } from '../queries/list-orders.query';

@QueryHandler(ListOrdersQuery)
export class ListOrdersHandler implements IQueryHandler<ListOrdersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ------------------------------------------------------
   * List Orders (Cursor Pagination)
   * ------------------------------------------------------
   */
  async execute(query: ListOrdersQuery) {
    const take = query.limit + 1;
    const orders = await this.prisma.order.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      orderBy: [{ createdAt: query.direction }, { id: query.direction }],
      take,
    });

    const hasMore = orders.length > query.limit;
    const pageItems = hasMore ? orders.slice(0, query.limit) : orders;
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
        limit: query.limit,
        direction: query.direction,
      },
    };
  }
}

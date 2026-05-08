/** ----- Orders - DTOs (Responses) ----- **/
export type OrderListItemDto = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paypalOrderId: string | null;
  updatedAt: string;
};

export type CursorPageInfoDto = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  direction: 'asc' | 'desc';
};

export type OrderListDto = {
  data: OrderListItemDto[];
  pageInfo: CursorPageInfoDto;
};

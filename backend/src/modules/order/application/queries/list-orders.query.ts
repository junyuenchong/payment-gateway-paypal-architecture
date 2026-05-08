import type {
  CursorDirection,
  CursorPaginationQueryDto,
} from '../../../../common/dto/cursor-pagination-query.dto';

export type ListOrdersDirection = CursorDirection;

export class ListOrdersQuery {
  /** ----- List Orders Query Model ----- **/
  constructor(
    public readonly cursor?: string,
    public readonly limit: number = 20,
    public readonly direction: ListOrdersDirection = 'desc',
  ) {}

  /** ----- Build Query From DTO ----- **/
  static fromDto(dto: CursorPaginationQueryDto): ListOrdersQuery {
    return new ListOrdersQuery(dto.cursor, dto.limit, dto.direction);
  }
}

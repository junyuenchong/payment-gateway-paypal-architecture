import type {
  CursorDirection,
  CursorPaginationQueryDto,
} from '../../../../common/shared/dto/cursor-pagination-query.dto';

export class GetOrderQuery {
  /** ----- Get Order Query Model ----- **/
  constructor(
    public readonly id: string,
    public readonly eventsCursor?: string,
    public readonly eventsLimit: number = 20,
    public readonly eventsDirection: CursorDirection = 'desc',
  ) {}

  /** ----- Build Query From DTO ----- **/
  static fromDto(id: string, dto: CursorPaginationQueryDto): GetOrderQuery {
    return new GetOrderQuery(id, dto.cursor, dto.limit, dto.direction);
  }
}

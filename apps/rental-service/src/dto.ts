import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RentBookDto {
  @IsUUID()
  bookId!: string;
}

export class ListRentalsQueryDto {
  @IsIn(['active', 'returned'])
  tab: 'active' | 'returned' = 'active';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 5;
}

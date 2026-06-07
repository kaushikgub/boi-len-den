import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsIn(['CHARGED', 'REFUNDED'])
  status?: 'CHARGED' | 'REFUNDED';

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

import { IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateBookDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  author!: string;

  @IsInt()
  @Min(1)
  totalCopies!: number;
}

export class ReserveDto {
  @IsUUID()
  bookId!: string;

  /** Supplied by rental-service; makes the reserve call idempotent. */
  @IsUUID()
  reservationId!: string;
}

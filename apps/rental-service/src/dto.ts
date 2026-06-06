import { IsUUID } from 'class-validator';

export class RentBookDto {
  @IsUUID()
  bookId!: string;
}

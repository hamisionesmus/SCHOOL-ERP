import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class IssueLoanDto {
  @ApiProperty()
  @IsString()
  bookId!: string;

  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ example: '2026-08-14' })
  @IsDateString()
  dueDate!: string;
}

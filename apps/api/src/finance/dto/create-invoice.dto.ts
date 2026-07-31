import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, Min } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  term!: number;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  dueDate!: string;
}

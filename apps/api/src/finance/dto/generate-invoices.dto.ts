import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class GenerateInvoicesDto {
  @ApiProperty()
  @IsString()
  feeStructureId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  dueDate!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ enum: ['MONTHLY', 'YEARLY'] })
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle!: 'MONTHLY' | 'YEARLY';

  @ApiProperty({ description: 'Whole KES' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ description: 'Defaults to 14 days from now' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}

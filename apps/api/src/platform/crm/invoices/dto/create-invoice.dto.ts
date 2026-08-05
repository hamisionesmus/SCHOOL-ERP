import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min, MinLength } from 'class-validator';

const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty({ enum: PRODUCT_LINES })
  @IsIn(PRODUCT_LINES)
  productLine!: (typeof PRODUCT_LINES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(1)
  subtotal!: number;

  @ApiProperty({ example: 16, required: false, description: 'VAT percentage — defaults to the standard Kenyan rate' })
  @IsOptional()
  @IsInt()
  @Min(0)
  vatRate?: number;

  @ApiProperty()
  @IsISO8601()
  dueDate!: string;
}

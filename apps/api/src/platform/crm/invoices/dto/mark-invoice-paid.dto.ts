import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarkInvoicePaidDto {
  @ApiProperty()
  @IsString()
  paymentMethod!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentReference?: string;
}

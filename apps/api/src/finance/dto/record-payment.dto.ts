import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const METHODS = ['CASH', 'BANK', 'MPESA'] as const;

export class RecordPaymentDto {
  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: METHODS })
  @IsIn(METHODS)
  method!: (typeof METHODS)[number];

  @ApiPropertyOptional({ description: 'Bank slip no., M-Pesa receipt no., etc.' })
  @IsOptional()
  @IsString()
  reference?: string;
}

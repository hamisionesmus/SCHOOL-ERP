import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Whole KES' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: ['BANK', 'MPESA', 'CASH'] })
  @IsIn(['BANK', 'MPESA', 'CASH'])
  method!: 'BANK' | 'MPESA' | 'CASH';

  @ApiPropertyOptional({ description: 'Bank slip no., M-Pesa paybill transaction code, etc.' })
  @IsOptional()
  @IsString()
  reference?: string;
}

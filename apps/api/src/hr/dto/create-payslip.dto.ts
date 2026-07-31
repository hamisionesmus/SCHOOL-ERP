import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePayslipDto {
  @ApiProperty()
  @IsString()
  staffUserId!: string;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  periodYear!: number;

  @ApiProperty({ description: 'Whole KES' })
  @IsInt()
  @Min(0)
  grossPay!: number;

  @ApiPropertyOptional({ description: 'Whole KES' })
  @IsOptional()
  @IsInt()
  @Min(0)
  deductions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

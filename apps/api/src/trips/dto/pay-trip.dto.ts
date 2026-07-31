import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const METHODS = ['CASH', 'BANK', 'MPESA'] as const;

export class PayTripDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: METHODS })
  @IsIn(METHODS)
  method!: (typeof METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

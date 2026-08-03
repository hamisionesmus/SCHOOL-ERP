import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';

export class PricingTierRowDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  minHeadcount!: number;

  @ApiProperty({ example: 100, required: false, description: 'Omit for the top-open tier (no upper bound)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxHeadcount?: number;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0)
  priceKes!: number;

  @ApiProperty({ example: 500, required: false, description: 'Storage cap in MB for schools in this tier — omit for no cap' })
  @IsOptional()
  @IsInt()
  @Min(0)
  storageLimitMb?: number;
}

export class UpdatePricingTiersDto {
  @ApiProperty({ type: [PricingTierRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PricingTierRowDto)
  tiers!: PricingTierRowDto[];
}

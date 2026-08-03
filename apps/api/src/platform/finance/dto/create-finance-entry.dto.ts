import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

const TYPES = ['IN', 'OUT'] as const;

export class CreateFinanceEntryDto {
  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(2)
  category!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

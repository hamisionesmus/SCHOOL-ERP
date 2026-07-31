import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const TYPES = ['IN', 'OUT'] as const;

export class RecordMovementDto {
  @ApiProperty({ enum: TYPES })
  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

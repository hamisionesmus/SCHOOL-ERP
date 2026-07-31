import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'Exercise books' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Stationery' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 'pcs' })
  @IsString()
  unit!: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;
}

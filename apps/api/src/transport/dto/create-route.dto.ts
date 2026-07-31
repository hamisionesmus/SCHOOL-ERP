import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRouteDto {
  @ApiProperty({ example: 'Route A - Kilimani' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({
    description: 'Static travel-time estimate used for the departure-notification SMS ETA (no live GPS)',
    example: 35,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;
}

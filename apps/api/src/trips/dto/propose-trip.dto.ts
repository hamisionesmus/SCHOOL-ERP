import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ProposeTripDto {
  @ApiProperty({ example: 'Grade 4 Nairobi National Museum Trip' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Educational visit tied to the CBC Social Studies unit.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Nairobi National Museum' })
  @IsString()
  destination!: string;

  @ApiProperty({ example: '2026-09-20' })
  @IsDateString()
  tripDate!: string;

  @ApiProperty({ example: 800, description: 'Whole KES per student' })
  @IsInt()
  @Min(1)
  costPerStudent!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2026' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '2026-01-06' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

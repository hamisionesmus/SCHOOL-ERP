import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum SchoolEventCategoryDto {
  HOLIDAY = 'HOLIDAY',
  TERM = 'TERM',
  EXAM = 'EXAM',
  MEETING = 'MEETING',
  SPORTS = 'SPORTS',
  TRIP = 'TRIP',
  OTHER = 'OTHER',
}

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SchoolEventCategoryDto })
  @IsEnum(SchoolEventCategoryDto)
  category!: SchoolEventCategoryDto;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}

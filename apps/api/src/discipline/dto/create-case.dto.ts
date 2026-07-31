import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const CATEGORIES = ['WARNING', 'DETENTION', 'SUSPENSION', 'POSITIVE_BEHAVIOR'] as const;

export class CreateCaseDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @ApiProperty({ example: 'Disrupted class during Math lesson' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'Verbal warning given, parent notified' })
  @IsOptional()
  @IsString()
  actionTaken?: string;
}

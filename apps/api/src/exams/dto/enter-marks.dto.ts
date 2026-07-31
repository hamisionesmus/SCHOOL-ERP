import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const RUBRIC_LEVELS = ['EE', 'ME', 'AE', 'BE'] as const;

export class MarkEntryDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ required: false, description: 'Required when the exam-subject scoringMode is NUMERIC' })
  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @ApiProperty({ required: false, enum: RUBRIC_LEVELS, description: 'Required when scoringMode is RUBRIC' })
  @IsOptional()
  @IsIn(RUBRIC_LEVELS)
  rubricLevel?: (typeof RUBRIC_LEVELS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class EnterMarksDto {
  @ApiProperty({ type: [MarkEntryDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  entries!: MarkEntryDto[];
}

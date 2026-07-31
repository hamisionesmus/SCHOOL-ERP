import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const SCORING_MODES = ['NUMERIC', 'RUBRIC'] as const;

export class CreateExamSubjectDto {
  @ApiProperty()
  @IsString()
  subjectId!: string;

  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional({ enum: SCORING_MODES, default: 'NUMERIC' })
  @IsOptional()
  @IsIn(SCORING_MODES)
  scoringMode?: (typeof SCORING_MODES)[number];
}

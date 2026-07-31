import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsString, Min } from 'class-validator';

const EXAM_TYPES = ['CAT', 'MIDTERM', 'ENDTERM', 'CBC_ASSESSMENT', 'PROJECT', 'PRACTICAL'] as const;

export class CreateExamDto {
  @ApiProperty({ example: 'Term 2 CAT 1' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: EXAM_TYPES })
  @IsIn(EXAM_TYPES)
  examType!: (typeof EXAM_TYPES)[number];

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  term!: number;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-14' })
  @IsDateString()
  endDate!: string;
}

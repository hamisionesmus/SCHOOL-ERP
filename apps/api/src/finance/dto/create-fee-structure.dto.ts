import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateFeeStructureDto {
  @ApiProperty({ example: 'Grade 4 Term 2 Fees' })
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  gradeLevelId!: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  term!: number;

  @ApiProperty({ example: 15000, description: 'Whole KES' })
  @IsInt()
  @Min(1)
  amount!: number;
}

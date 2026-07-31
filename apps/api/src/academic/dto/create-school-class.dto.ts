import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSchoolClassDto {
  @ApiProperty({ example: 'Grade 4 Blue' })
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  gradeLevelId!: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classTeacherId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '2018-04-12' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 'FEMALE' })
  @IsString()
  gender!: string;

  @ApiProperty()
  @IsString()
  gradeLevelId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentClassId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nemisNumber?: string;
}

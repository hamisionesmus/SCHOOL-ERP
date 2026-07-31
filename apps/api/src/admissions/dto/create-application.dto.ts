import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '2019-02-10' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 'FEMALE' })
  @IsString()
  gender!: string;

  @ApiProperty()
  @IsString()
  gradeLevelId!: string;

  @ApiProperty()
  @IsString()
  guardianName!: string;

  @ApiProperty()
  @IsEmail()
  guardianEmail!: string;

  @ApiProperty()
  @IsString()
  guardianPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

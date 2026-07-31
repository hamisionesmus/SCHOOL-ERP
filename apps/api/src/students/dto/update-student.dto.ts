import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateStudentDto {
  @ApiPropertyOptional({ description: 'Usually the URL returned by POST /uploads' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nemisNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentClassId?: string;
}

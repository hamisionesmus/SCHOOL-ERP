import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSickSheetDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'Fever and flu symptoms' })
  @IsString()
  @MinLength(2)
  reason!: string;

  @ApiPropertyOptional({ description: 'Date the student is expected back, if known' })
  @IsOptional()
  @IsDateString()
  recommendedRestUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

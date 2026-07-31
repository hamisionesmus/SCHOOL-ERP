import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateClinicVisitDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'Headache and mild fever' })
  @IsString()
  symptoms!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medication?: string;
}

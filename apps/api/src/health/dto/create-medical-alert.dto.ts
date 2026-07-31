import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateMedicalAlertDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'Peanut allergy' })
  @IsString()
  condition!: string;

  @ApiProperty({ example: 'HIGH' })
  @IsString()
  severity!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateTrainerReportDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiProperty()
  @IsISO8601()
  periodStart!: string;

  @ApiProperty()
  @IsISO8601()
  periodEnd!: string;

  @ApiProperty()
  @IsString()
  progressSummary!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  challenges?: string;
}

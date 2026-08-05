import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'TERMINATED'] as const;

export class UpdateTrainerProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  centerId?: string;

  @ApiProperty({ enum: TRACKS, required: false })
  @IsOptional()
  @IsIn(TRACKS)
  track?: (typeof TRACKS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlySalaryKes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  contractStartDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  contractEndDate?: string;

  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

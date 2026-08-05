import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;
const STATUSES = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export class UpsertProgramDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: TRACKS })
  @IsIn(TRACKS)
  track!: (typeof TRACKS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  centerId?: string;

  @ApiProperty({ required: false, description: 'HamzoneTrainerProfile id' })
  @IsOptional()
  @IsString()
  trainerId?: string;

  @ApiProperty()
  @IsISO8601()
  startDate!: string;

  @ApiProperty()
  @IsISO8601()
  endDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

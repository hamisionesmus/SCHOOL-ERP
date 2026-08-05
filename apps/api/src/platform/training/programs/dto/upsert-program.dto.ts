import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const TRACKS = ['FRONTEND', 'BACKEND', 'CODING_ROBOTICS', 'OTHER'] as const;
const STATUSES = ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export class UpsertProgramDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: TRACKS })
  @IsIn(TRACKS)
  track!: (typeof TRACKS)[number];

  @ApiProperty({ required: false, description: 'Required when track is OTHER' })
  @ValidateIf((o) => o.track === 'OTHER')
  @IsString()
  @MinLength(1, { message: 'trackOther is required when track is OTHER' })
  trackOther?: string;

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

  @ApiProperty({ required: false, description: 'What the cohort will build by the end of training — helps admins plan costs early, especially for robotics' })
  @IsOptional()
  @IsString()
  plannedProjectDescription?: string;

  @ApiProperty({ required: false, description: 'Deadline for the trainer to commit to the planned project, for early cost preparation' })
  @IsOptional()
  @IsISO8601()
  plannedProjectDueAt?: string;
}

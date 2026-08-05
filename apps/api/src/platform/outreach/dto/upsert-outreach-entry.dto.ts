import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

const TYPES = ['ACCOUNT_MANAGEMENT', 'TASKING', 'OUTLIER', 'HANDSHAKE', 'OTHER'] as const;
const STATUSES = ['NEW', 'ONBOARDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] as const;

export class UpsertOutreachEntryDto {
  @ApiProperty()
  @IsString()
  contactName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ enum: TYPES, required: false })
  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiProperty()
  @IsISO8601()
  receivedAt!: string;

  @ApiProperty({ required: false, description: 'Which browser / anti-detect-browser profile this account logs in through — e.g. Chrome, iX Browser, GoLogin, MoreLogin' })
  @IsOptional()
  @IsString()
  loginBrowser?: string;

  @ApiProperty({ required: false, description: 'PlatformUser id if assigned to someone in the system' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedToExternalName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedToExternalPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

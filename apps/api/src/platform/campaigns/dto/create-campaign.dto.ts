import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ExternalRecipientDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

/** Every field is an independent opt-in — the final recipient list is the union of whichever of
 * these are set, deduped (see CampaignsService.resolveRecipients()). Letting the Super Admin
 * combine e.g. "all schools" with a couple of hand-added external contacts in one send. */
export class CampaignTargetsDto {
  @ApiProperty({ required: false, description: 'Every school (via its registered contact email/phone)' })
  @IsOptional()
  @IsBoolean()
  allSchools?: boolean;

  @ApiProperty({ required: false, description: 'Schools with a pending or overdue invoice' })
  @IsOptional()
  @IsBoolean()
  schoolsWithDebt?: boolean;

  @ApiProperty({ required: false, description: 'Every platform team admin (Super/Sub/Assistant)' })
  @IsOptional()
  @IsBoolean()
  allPlatformAdmins?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformUserIds?: string[];

  @ApiProperty({ required: false, type: [ExternalRecipientDto], description: 'People not in the system — name + email/phone typed in directly' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalRecipientDto)
  external?: ExternalRecipientDto[];
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  smsBody?: string;

  @ApiProperty({ enum: ['EMAIL', 'SMS', 'BOTH'] })
  @IsIn(['EMAIL', 'SMS', 'BOTH'])
  channel!: 'EMAIL' | 'SMS' | 'BOTH';

  @ApiProperty({ required: false, description: 'ISO timestamp — omit or leave in the past to send immediately' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiProperty({ type: CampaignTargetsDto })
  @ValidateNested()
  @Type(() => CampaignTargetsDto)
  targets!: CampaignTargetsDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAILBOX_KEYS, MailboxKey } from '../mailbox-keys';

export class UpdateMailboxCredentialsDto {
  @ApiProperty({ enum: MAILBOX_KEYS })
  @IsIn(MAILBOX_KEYS)
  key!: MailboxKey;

  // Editable in case the default address/label seeded for this key needs correcting — the `key`
  // (INFO/PARTNER/BILLING/PERSONAL) is the fixed identifier, the actual mailbox address isn't.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imapHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  imapSecure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  // Blank/omitted means "don't change" — same convention as every other secret field in this
  // codebase (see PlatformSettingsService's SECRET_FIELDS masking) so re-saving other fields never
  // accidentally wipes a password the client can't see to resubmit.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;
}

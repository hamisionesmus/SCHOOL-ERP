import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paybillNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paybillAccountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stkEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bankTransferEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paybillEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  demoReminderDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  renewalReminderDaysBefore?: number;

  // M-Pesa Daraja. DB-backed so a Super Admin can change them from the UI (OTP-gated, same as
  // everything else on this model) without editing server env vars and redeploying. Each field is
  // resolved as dbValue ?? envValue at call time — see PlatformMpesaService.
  @ApiPropertyOptional({ enum: ['sandbox', 'production'] })
  @IsOptional()
  @IsString()
  mpesaEnv?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpesaConsumerKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpesaConsumerSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpesaShortcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpesaPasskey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpesaCallbackUrl?: string;

  // Resend (email).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resendApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resendFromAddress?: string;

  // Advanta (SMS).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  advantaApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  advantaPartnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  advantaSenderId?: string;

  // Platform-wide login-page branding — never per-school.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  systemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginTagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginSubtitle?: string;

  // Dynamic login-page identity + platform-wide watermark — each falls back to a built-in frontend
  // default (see login/page.tsx's DEFAULT_BRANDING and layout.tsx's BuiltByWatermark) when unset.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginLogoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginHeading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginHelperText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginFooterText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  builtByText?: string;
}

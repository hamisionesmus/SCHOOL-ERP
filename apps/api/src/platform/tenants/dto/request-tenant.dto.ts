import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class RequestTenantDto {
  @ApiProperty({ example: 'Greenfield Academy' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'greenfield-academy' })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters/numbers separated by hyphens',
  })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsSenderId?: string;

  @ApiProperty({ description: "First School Administrator's email", example: 'admin@greenfield.ac.ke' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ description: "First School Administrator's full name", example: 'Jane Wanjiru' })
  @IsString()
  adminFullName!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiPropertyOptional({ description: 'For the demo welcome SMS, if provided (E.164 or local format)' })
  @IsOptional()
  @IsString()
  adminPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Create as a time-boxed demo account instead of a normal school' })
  @IsOptional()
  @IsBoolean()
  isDemo?: boolean;

  @ApiPropertyOptional({ description: 'Demo lifetime in hours (e.g. 24 for 1 day, 4 for 4 hours) — required when isDemo is true' })
  @IsOptional()
  @IsInt()
  @Min(1)
  demoDurationHours?: number;

  @ApiPropertyOptional({
    description:
      'One-time activation fee in KES the school must pay via M-Pesa STK push before login works — required for non-demo requests, ignored for demo requests.',
    example: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  activationFeeKes?: number;
}

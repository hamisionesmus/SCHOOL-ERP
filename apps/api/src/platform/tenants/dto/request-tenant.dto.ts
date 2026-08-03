import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { KENYA_COUNTIES } from '../../../common/kenya-counties';

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

  @ApiPropertyOptional({ enum: KENYA_COUNTIES })
  @IsOptional()
  @IsIn(KENYA_COUNTIES)
  county?: string;

  @ApiPropertyOptional({ description: 'Town/city — free text' })
  @IsOptional()
  @IsString()
  town?: string;

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

  @ApiProperty({ description: "The new admin's phone (E.164 or local format) — required, an OTP is sent here to verify the number/consent before the school is created" })
  @IsString()
  adminPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({
    description:
      'real: paid, activation-fee-gated. demo: time-boxed trial, free. test: same as demo but deletable — see TenantsService.',
    enum: ['real', 'demo', 'test'],
  })
  @IsIn(['real', 'demo', 'test'])
  accountType!: 'real' | 'demo' | 'test';

  @ApiPropertyOptional({ description: 'Demo/test lifetime in hours (e.g. 24 for 1 day, 4 for 4 hours) — required when accountType is demo or test' })
  @IsOptional()
  @IsInt()
  @Min(1)
  demoDurationHours?: number;

  @ApiPropertyOptional({
    description: 'Which billing period the activation fee covers — required for real accounts.',
    enum: ['MONTHLY', 'HALF_YEARLY', 'YEARLY'],
  })
  @IsOptional()
  @IsIn(['MONTHLY', 'HALF_YEARLY', 'YEARLY'])
  activationBillingCycle?: 'MONTHLY' | 'HALF_YEARLY' | 'YEARLY';

  @ApiPropertyOptional({ description: 'Expected student count — required for real accounts, drives the computed activation fee.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  studentCount?: number;

  @ApiPropertyOptional({ description: 'Expected teacher count — required for real accounts, drives the computed activation fee.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  teacherCount?: number;

  @ApiPropertyOptional({ description: 'Expected non-teaching-staff count — required for real accounts, drives the computed activation fee.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  nonTeachingStaffCount?: number;
}

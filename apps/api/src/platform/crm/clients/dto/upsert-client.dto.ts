import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

const CLIENT_TYPES = ['INDIVIDUAL', 'SCHOOL', 'BUSINESS'] as const;
const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;

export class UpsertClientDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: CLIENT_TYPES, required: false })
  @IsOptional()
  @IsIn(CLIENT_TYPES)
  type?: (typeof CLIENT_TYPES)[number];

  @ApiProperty({ enum: PRODUCT_LINES, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(PRODUCT_LINES, { each: true })
  productLines?: (typeof PRODUCT_LINES)[number][];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: "The client's own website/system/domain, if applicable" })
  @IsOptional()
  @IsString()
  systemUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  domainActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  nextPaymentDueAt?: string;

  @ApiProperty({ required: false, description: 'Link to an existing School-ERP tenant if this client is also a school on the platform' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsISO8601, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;
const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'] as const;

// Shared by both create (clientName/interest are required there — enforced in the service, since
// an update should be able to send just `{ status }` without re-submitting the whole record) and
// update.
export class UpsertLeadDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ enum: PRODUCT_LINES, required: false })
  @IsOptional()
  @IsIn(PRODUCT_LINES)
  interest?: (typeof PRODUCT_LINES)[number];

  @ApiProperty({ required: false, description: 'Required when interest is OTHER' })
  @ValidateIf((o) => o.interest === 'OTHER')
  @IsString()
  @MinLength(1, { message: 'interestOther is required when interest is OTHER' })
  interestOther?: string;

  @ApiProperty({ required: false, description: 'Where the marketer met this lead — e.g. a town, an event' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  followUpAt?: string;

  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}

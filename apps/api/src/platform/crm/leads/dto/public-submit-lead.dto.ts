import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const PRODUCT_LINES = ['SCHOOL_ERP', 'DTP_TRAINING', 'CODING_ROBOTICS', 'WEBSITES', 'SACCO_SYSTEMS', 'HOSPITAL_SYSTEMS', 'OTHER'] as const;

// Deliberately smaller than UpsertLeadDto — no `status`/`followUpAt` (those are internal triage
// fields an outside caller has no business setting) and both clientName/interest are required
// up front, since a public submission is always a create, never a partial update.
export class PublicSubmitLeadDto {
  @ApiProperty({ example: 'Jane Wanjiru' })
  @IsString()
  @MinLength(1)
  clientName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ enum: PRODUCT_LINES })
  @IsIn(PRODUCT_LINES)
  interest!: (typeof PRODUCT_LINES)[number];

  @ApiProperty({ required: false, description: 'Town/city the enquiry came from' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false, description: 'Free-text message from the contact form' })
  @IsOptional()
  @IsString()
  notes?: string;
}

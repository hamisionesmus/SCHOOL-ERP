import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const CATEGORIES = ['POSTER', 'CERTIFICATE', 'BROCHURE', 'OTHER'] as const;

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: CATEGORIES, required: false })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiProperty({ description: 'The /uploads/... URL returned by POST /uploads' })
  @IsString()
  fileUrl!: string;

  @ApiProperty({ required: false, description: 'Set when this is a training resource tied to a specific cohort' })
  @IsOptional()
  @IsString()
  trainingProgramId?: string;
}

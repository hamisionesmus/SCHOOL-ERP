import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const CATEGORIES = ['TECHNICAL', 'BILLING', 'ACCOUNT', 'GENERAL', 'COMPLAINT', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({ description: 'Required when category is OTHER' })
  @ValidateIf((o) => o.category === 'OTHER')
  @IsString()
  @MinLength(1, { message: 'categoryOther is required when category is OTHER' })
  categoryOther?: string;

  @ApiPropertyOptional({ enum: PRIORITIES, default: 'NORMAL' })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({ enum: PRIORITIES, default: 'NORMAL' })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];
}

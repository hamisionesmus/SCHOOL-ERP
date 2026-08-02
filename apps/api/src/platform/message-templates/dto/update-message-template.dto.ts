import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMessageTemplateDto {
  @ApiProperty({ description: 'Template key, e.g. WELCOME_REAL, ACTIVATED, DEMO_REMINDER' })
  @IsString()
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsBody?: string;
}

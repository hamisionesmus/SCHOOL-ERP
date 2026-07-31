import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Usually the URL returned by POST /uploads' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  primaryColor?: string;

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

  @ApiPropertyOptional({ example: 'To nurture confident, competent learners for Kenya and beyond.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mission?: string;

  @ApiPropertyOptional({ example: 'To be the leading CBC school in the region by 2030.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  vision?: string;

  @ApiPropertyOptional({ example: 'Excellence Through Character' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  motto?: string;
}

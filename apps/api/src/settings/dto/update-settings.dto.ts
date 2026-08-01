import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: '#0f172a', description: 'Sidebar background color — text/hover/active shades are derived automatically for readability' })
  @IsOptional()
  @IsString()
  sidebarColor?: string;

  @ApiPropertyOptional({ example: '#f8fafc', description: 'Main content-pane background color, behind the (always-white) cards' })
  @IsOptional()
  @IsString()
  contentBgColor?: string;

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

  @ApiPropertyOptional({
    description: 'Numeric score % at/above which a report-card score renders green instead of red',
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  passMarkPercent?: number;
}

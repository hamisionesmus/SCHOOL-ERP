import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Greenfield Academy' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'greenfield-academy',
    description: 'Lowercase, hyphenated, unique. Used as the subdomain and schema-name suffix.',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters/numbers separated by hyphens',
  })
  slug!: string;

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
}

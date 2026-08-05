import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class PublicSubmitApplicationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ required: false, description: 'Physical address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  experienceSummary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @ApiProperty({ required: false, type: [String], description: 'URLs returned by the certificate-upload endpoint' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificateUrls?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coverNote?: string;
}

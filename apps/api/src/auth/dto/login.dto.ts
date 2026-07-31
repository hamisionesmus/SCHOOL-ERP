import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@myschool.ac.ke' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    description: 'Tenant (school) slug. Omit to log in as platform Super Admin.',
    example: 'greenfield-academy',
  })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

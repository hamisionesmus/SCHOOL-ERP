import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class AddGuardianDto {
  @ApiPropertyOptional({ description: 'Existing user id to link as guardian. Omit to create a new Parent user.' })
  @IsOptional()
  @IsString()
  guardianUserId?: string;

  @ApiPropertyOptional({ description: 'Required when creating a new guardian user' })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({ description: 'Required when creating a new guardian user' })
  @IsOptional()
  @IsString()
  guardianFullName?: string;

  @ApiProperty({ example: 'MOTHER' })
  @IsString()
  relationship!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;
}

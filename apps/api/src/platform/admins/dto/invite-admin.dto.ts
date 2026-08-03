import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const INVITABLE_ROLES = ['SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'] as const;
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

export class InviteAdminDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(9)
  phone!: string;

  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsIn(INVITABLE_ROLES)
  role!: (typeof INVITABLE_ROLES)[number];

  @ApiPropertyOptional({ enum: GENDERS })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: (typeof GENDERS)[number];
}

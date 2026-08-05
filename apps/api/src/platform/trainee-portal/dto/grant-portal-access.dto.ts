import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class GrantPortalAccessDto {
  @ApiProperty({ description: "The trainee's own email — becomes their portal login" })
  @IsEmail()
  portalEmail!: string;
}

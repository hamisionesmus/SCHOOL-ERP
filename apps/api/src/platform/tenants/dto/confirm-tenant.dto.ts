import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmTenantDto {
  @ApiProperty()
  @IsString()
  requestId!: string;

  @ApiProperty({ example: '482913', description: "The Super Admin's own confirmation code" })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ example: '193742', description: "The OTP sent to the new school admin's phone" })
  @IsString()
  @Length(6, 6)
  adminOtpCode!: string;
}

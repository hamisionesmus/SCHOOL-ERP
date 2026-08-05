import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ShareMinutesDto {
  @ApiProperty({ required: false, description: 'Share with a specific PlatformUser already in the system' })
  @IsOptional()
  @IsString()
  toUserId?: string;

  @ApiProperty({ required: false, description: 'Or an arbitrary email address, not necessarily a system account' })
  @IsOptional()
  @IsEmail()
  toEmail?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SetWhatsAppPinDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: '4-6 digit PIN' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin!: string;
}

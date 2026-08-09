import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ClearWhatsAppPinDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class SetPhoneDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: 'Kenyan phone number, any common format (0712345678, 254712345678, +254712345678)' })
  @IsString()
  @Matches(/^(\+?254|0)?[71]\d{8}$/, { message: 'Enter a valid Kenyan phone number' })
  phone!: string;
}

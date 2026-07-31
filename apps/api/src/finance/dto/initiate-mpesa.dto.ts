import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class InitiateMpesaDto {
  @ApiProperty({ example: '254712345678' })
  @IsString()
  @Matches(/^254\d{9}$/, { message: 'phoneNumber must be in 2547XXXXXXXX format' })
  phoneNumber!: string;
}

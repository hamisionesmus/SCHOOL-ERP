import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class InitiateActivationPaymentDto {
  @ApiProperty({ example: '0712345678' })
  @IsString()
  @MinLength(9)
  phone!: string;
}

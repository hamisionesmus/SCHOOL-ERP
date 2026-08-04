import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PreviewInvoiceEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;
}

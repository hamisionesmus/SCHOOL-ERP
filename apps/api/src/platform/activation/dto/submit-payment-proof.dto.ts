import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class SubmitPaymentProofDto {
  @ApiProperty({ enum: ['BANK', 'PAYBILL'] })
  @IsIn(['BANK', 'PAYBILL'])
  method!: 'BANK' | 'PAYBILL';

  @ApiProperty({ description: 'The pasted payment confirmation message' })
  @IsString()
  @MinLength(5)
  message!: string;
}

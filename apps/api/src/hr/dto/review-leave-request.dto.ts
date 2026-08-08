import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewLeaveRequestDto {
  @ApiProperty({ required: false, description: "Threaded onto the workflow step's action record when an approval chain is active" })
  @IsOptional()
  @IsString()
  comment?: string;
}

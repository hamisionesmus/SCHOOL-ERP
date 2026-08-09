import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewTripDto {
  @ApiProperty({ required: false, description: "Threaded onto the workflow step's action record when an approval chain is active; also stored as the rejection reason on the direct (unconfigured-tenant) path" })
  @IsOptional()
  @IsString()
  comment?: string;
}

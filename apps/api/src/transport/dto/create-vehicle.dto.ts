import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: 'KDA 123X' })
  @IsString()
  plateNumber!: string;

  @ApiProperty({ example: 33 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ description: 'User id of the driver' })
  @IsOptional()
  @IsString()
  driverId?: string;
}

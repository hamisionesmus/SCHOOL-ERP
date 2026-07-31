import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '2018-04-12' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 'FEMALE' })
  @IsString()
  gender!: string;

  @ApiProperty()
  @IsString()
  gradeLevelId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentClassId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upiNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nemisNumber?: string;

  @ApiPropertyOptional({ description: 'Free-text home address — apartment/estate/plot, etc.' })
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional({ description: 'Nearby landmark to help the driver find the drop-off point' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional({ description: 'From the map pin-drop picker' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'From the map pin-drop picker' })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

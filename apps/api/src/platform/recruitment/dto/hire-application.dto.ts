import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class HireApplicationDto {
  @ApiProperty({ required: false, description: 'Optional first task title — creates an initial HamzoneStaffTask so the new hire knows where to start' })
  @IsOptional()
  @IsString()
  taskTitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taskDescription?: string;

  @ApiProperty({ required: false, description: 'Which repo to work in, for software engineer / dev hires' })
  @IsOptional()
  @IsString()
  taskRepoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  taskDueDate?: string;
}

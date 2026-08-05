import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

class TraineeAttendanceEntryDto {
  @ApiProperty({ required: false, description: 'Existing HamzoneTrainee id — omit for a first-time roster entry' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender!: (typeof GENDERS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  age?: number;

  @ApiProperty({ required: false, description: 'e.g. "Form 4", "Certificate", "Diploma"' })
  @IsOptional()
  @IsString()
  educationLevel?: string;

  @ApiProperty()
  @IsBoolean()
  present!: boolean;
}

// The trainee's name is required on every submission, per the user's explicit instruction — "the
// very first time the trainer enters the name of the trainees not just the number... names are
// required for verification." Entries without an `id` are new roster additions (first time seen);
// entries with one update attendance against the existing HamzoneTrainee row.
export class SubmitDailyRegisterDto {
  @ApiProperty({ type: [TraineeAttendanceEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TraineeAttendanceEntryDto)
  trainees!: TraineeAttendanceEntryDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  topicsCovered?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

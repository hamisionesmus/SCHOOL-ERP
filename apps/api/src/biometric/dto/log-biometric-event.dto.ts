import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class LogBiometricEventDto {
  @ApiProperty({ enum: ['STUDENT', 'STAFF'] })
  @IsIn(['STUDENT', 'STAFF'])
  subjectType!: 'STUDENT' | 'STAFF';

  @ApiPropertyOptional({ description: 'Required when subjectType is STUDENT' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Required when subjectType is STAFF' })
  @IsOptional()
  @IsString()
  staffUserId?: string;

  @ApiProperty({ enum: ['FACE', 'FINGERPRINT'] })
  @IsIn(['FACE', 'FINGERPRINT'])
  method!: 'FACE' | 'FINGERPRINT';

  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsIn(['IN', 'OUT'])
  direction!: 'IN' | 'OUT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

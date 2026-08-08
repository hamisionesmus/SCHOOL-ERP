import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class WorkflowStepInputDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: "Permission code required to act on this step, e.g. 'HR:EDIT'" })
  @IsString()
  approverPermissionCode!: string;

  @ApiProperty({ required: false, description: 'Hours before an unactioned step triggers a reminder' })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number;
}

export class UpsertWorkflowDefinitionDto {
  @ApiProperty({ type: [WorkflowStepInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepInputDto)
  steps!: WorkflowStepInputDto[];
}

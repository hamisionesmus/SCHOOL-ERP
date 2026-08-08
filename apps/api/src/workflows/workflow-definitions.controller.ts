import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { WorkflowDefinitionsService } from './workflow-definitions.service';
import { UpsertWorkflowDefinitionDto } from './dto/upsert-workflow-definition.dto';

/** Admin configuration of a workflow's step chain — gated the same way the existing role/permission
 * editor (RolesController) already is, rather than minting a new WORKFLOW:MANAGE code for a Phase-1
 * pilot with a single entity type. */
@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('TENANT:MANAGE_USERS')
@Controller('workflows/definitions')
export class WorkflowDefinitionsController {
  constructor(private readonly definitions: WorkflowDefinitionsService) {}

  @Get(':entityType')
  getActive(@CurrentUser() user: JwtUserPayload, @Param('entityType') entityType: string) {
    return this.definitions.getActive(user, entityType);
  }

  @Put(':entityType')
  upsert(
    @CurrentUser() user: JwtUserPayload,
    @Param('entityType') entityType: string,
    @Body() dto: UpsertWorkflowDefinitionDto,
  ) {
    return this.definitions.upsert(user, entityType, dto);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole, ALL_PLATFORM_ROLES } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { StaffTasksService } from './staff-tasks.service';
import { UpsertStaffTaskDto } from './dto/upsert-staff-task.dto';

@ApiTags('platform/staff-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/staff-tasks')
export class StaffTasksController {
  constructor(private readonly staffTasks: StaffTasksService) {}

  // Any platform role can see their own tasks (filtered client-side by /mine below); listing ALL
  // tasks (no filter) is still meaningful only to whoever manages assignments, but this endpoint
  // itself stays open to every role since `assignedToUserId` narrows it — admins pass their own id
  // if they want a personal view, or omit it if they hold broader access via the /mine convention.
  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @Get()
  list(@Query('assignedToUserId') assignedToUserId?: string) {
    return this.staffTasks.list(assignedToUserId);
  }

  @RequirePlatformRole(ALL_PLATFORM_ROLES)
  @Get('mine')
  mine(@CurrentUser() user: JwtUserPayload) {
    return this.staffTasks.list(user.sub);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffTasks.findOne(id);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @Post()
  create(@Body() dto: UpsertStaffTaskDto, @CurrentUser() user: JwtUserPayload) {
    return this.staffTasks.create(dto, user.sub);
  }

  @RequirePlatformRole(['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertStaffTaskDto>) {
    return this.staffTasks.update(id, dto);
  }

  @RequirePlatformRole(ALL_PLATFORM_ROLES)
  @Patch(':id/status')
  updateOwnStatus(@Param('id') id: string, @Body('status') status: 'TODO' | 'IN_PROGRESS' | 'DONE', @CurrentUser() user: JwtUserPayload) {
    return this.staffTasks.updateOwnStatus(id, user.sub, status);
  }
}

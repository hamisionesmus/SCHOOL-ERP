import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HrService } from './hr.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr/leave-requests')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.hrService.listLeaveRequests(user);
  }

  @Post()
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateLeaveRequestDto) {
    return this.hrService.createLeaveRequest(user, dto);
  }

  // No @RequirePermission here — HrService.setStatus() performs the correct check itself, either
  // "holds the current workflow step's permission" (when a WorkflowDefinition is active for
  // 'LEAVE_REQUEST') or "holds HR:EDIT" (the fallback, unconfigured-tenant path) — a flat guard can't
  // express the former. Same "authorization moved into the service" pattern this controller's own
  // POST route already uses.
  @Patch(':id/approve')
  approve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.hrService.approve(user, id, dto.comment);
  }

  @Patch(':id/reject')
  reject(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.hrService.reject(user, id, dto.comment);
  }
}

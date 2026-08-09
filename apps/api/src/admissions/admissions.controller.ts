import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { AdmissionsService } from './admissions.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';

@ApiTags('admissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admissions/applications')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @RequirePermission('ADMISSION:MANAGE')
  list(@CurrentUser() user: JwtUserPayload) {
    return this.admissionsService.list(user);
  }

  @Post()
  @RequirePermission('ADMISSION:MANAGE')
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateApplicationDto) {
    return this.admissionsService.create(user, dto);
  }

  @Patch(':id/status')
  @RequirePermission('ADMISSION:MANAGE')
  updateStatus(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.admissionsService.updateStatus(user, id, dto);
  }

  // No @RequirePermission here — AdmissionsService.setDecision() performs the correct check itself,
  // either "holds the current workflow step's permission" (when a WorkflowDefinition is active for
  // 'ADMISSION_APPLICATION') or "holds ADMISSION:MANAGE" (the fallback, unconfigured-tenant path) — a
  // flat guard can't express the former. Same pattern already used by HrController's approve/reject.
  @Patch(':id/approve')
  approve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: ReviewApplicationDto) {
    return this.admissionsService.approve(user, id, dto.comment);
  }

  @Patch(':id/reject')
  reject(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: ReviewApplicationDto) {
    return this.admissionsService.reject(user, id, dto.comment);
  }

  @Post(':id/admit')
  @RequirePermission('ADMISSION:MANAGE')
  admit(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.admissionsService.admit(user, id);
  }
}

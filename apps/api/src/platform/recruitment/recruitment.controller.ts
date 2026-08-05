import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { RecruitmentService } from './recruitment.service';
import { UpsertPositionDto } from './dto/upsert-position.dto';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { HireApplicationDto } from './dto/hire-application.dto';

@ApiTags('platform/recruitment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole('SUPER_ADMIN')
@Controller('platform/recruitment')
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @Get('positions')
  listPositions() {
    return this.recruitment.listPositions();
  }

  @Get('positions/:id')
  findPosition(@Param('id') id: string) {
    return this.recruitment.findPosition(id);
  }

  @Post('positions')
  createPosition(@Body() dto: UpsertPositionDto, @CurrentUser() user: JwtUserPayload) {
    return this.recruitment.createPosition(dto, user.sub);
  }

  @Patch('positions/:id')
  updatePosition(@Param('id') id: string, @Body() dto: Partial<UpsertPositionDto> & { status?: 'OPEN' | 'CLOSED' | 'FILLED' }) {
    return this.recruitment.updatePosition(id, dto);
  }

  @Get('applications')
  listApplications(@Query('positionId') positionId?: string, @Query('status') status?: string) {
    return this.recruitment.listApplications(positionId, status);
  }

  @Get('applications/:id')
  findApplication(@Param('id') id: string) {
    return this.recruitment.findApplication(id);
  }

  @Patch('applications/:id/schedule-interview')
  scheduleInterview(@Param('id') id: string, @Body() dto: ScheduleInterviewDto) {
    return this.recruitment.scheduleInterview(id, dto);
  }

  @Patch('applications/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectApplicationDto) {
    return this.recruitment.rejectApplication(id, dto);
  }

  @Post('applications/:id/hire')
  hire(@Param('id') id: string, @Body() dto: HireApplicationDto) {
    return this.recruitment.hire(id, dto);
  }
}

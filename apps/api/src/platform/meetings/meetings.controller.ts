import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { HamzoneMeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingMinutesDto } from './dto/update-meeting-minutes.dto';
import { ShareMinutesDto } from './dto/share-minutes.dto';

const ANY_PLATFORM_ROLE = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER', 'GIG_WORKER'] as const;

@ApiTags('platform/meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('platform/meetings')
export class HamzoneMeetingsController {
  constructor(private readonly meetings: HamzoneMeetingsService) {}

  @RequirePlatformRole()
  @Get()
  list() {
    return this.meetings.list();
  }

  // Meetings can be for trainers, leads, admins, developers, frontend, backend, etc. — every
  // platform role (including the restricted TRAINER/GIG_WORKER ones) needs to see their own.
  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Get('mine')
  mine(@CurrentUser() user: JwtUserPayload) {
    return this.meetings.listMine(user.sub, user.role ?? '');
  }

  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.meetings.findOne(id);
  }

  @RequirePlatformRole()
  @Post()
  create(@Body() dto: CreateMeetingDto, @CurrentUser() user: JwtUserPayload) {
    return this.meetings.create(dto, user.sub);
  }

  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Get(':id/attendance')
  attendance(@Param('id') id: string) {
    return this.meetings.attendanceSummary(id);
  }

  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Patch(':id/minutes')
  updateMinutes(@Param('id') id: string, @Body() dto: UpdateMeetingMinutesDto, @CurrentUser() user: JwtUserPayload) {
    return this.meetings.updateMinutes(id, user.sub, user.role ?? '', dto.minutes, user.moduleGrants);
  }

  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Patch(':id/end')
  end(@Param('id') id: string, @CurrentUser() user: JwtUserPayload) {
    return this.meetings.endMeeting(id, user.sub, user.role ?? '', user.moduleGrants);
  }

  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Get(':id/minutes-pdf')
  async minutesPdf(@Param('id') id: string, @Res() res: Response) {
    const { pdf, filename } = await this.meetings.downloadMinutesPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }

  @RequirePlatformRole([...ANY_PLATFORM_ROLE])
  @Post(':id/minutes/share')
  shareMinutes(@Param('id') id: string, @Body() dto: ShareMinutesDto, @CurrentUser() user: JwtUserPayload) {
    return this.meetings.shareMinutes(id, user.sub, user.role ?? '', dto.toUserId, dto.toEmail, user.moduleGrants);
  }
}

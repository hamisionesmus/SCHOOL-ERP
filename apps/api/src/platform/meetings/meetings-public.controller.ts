import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HamzoneMeetingsService } from './meetings.service';
import { JoinMeetingDto } from './dto/join-meeting.dto';
import { SubmitAbsenceReasonDto } from './dto/submit-absence-reason.dto';

// Entirely public — reached from the personalized join link every invitee gets in their invite
// email/SMS, before they ever need to log in. Same unauthenticated shape as DailyLinkPublicController;
// the signed token carries only the meeting id, identity comes from the email the visitor confirms.
@ApiTags('public/meetings')
@Controller('public/meetings')
export class MeetingsPublicController {
  constructor(private readonly meetings: HamzoneMeetingsService) {}

  @Get('join/:token')
  info(@Param('token') token: string, @Query('email') email?: string) {
    return this.meetings.getJoinInfo(token, email);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('join/:token')
  join(@Param('token') token: string, @Body() dto: JoinMeetingDto, @Req() req: Request) {
    return this.meetings.recordJoin(token, dto.email, dto.name, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('join/:token/absence-reason')
  absenceReason(@Param('token') token: string, @Body() dto: SubmitAbsenceReasonDto, @Req() req: Request) {
    return this.meetings.submitAbsenceReason(token, dto.email, dto.reason, req.ip, req.headers['user-agent']);
  }
}

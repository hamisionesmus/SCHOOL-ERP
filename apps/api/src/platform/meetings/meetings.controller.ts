import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { HamzoneMeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

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
}

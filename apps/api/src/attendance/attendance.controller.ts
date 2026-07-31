import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ReopenAttendanceDto } from './dto/reopen-attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query('classId') classId?: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.list(user, classId, date);
  }

  @Post()
  @RequirePermission('ATTENDANCE:MARK')
  mark(@CurrentUser() user: JwtUserPayload, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(user, dto);
  }

  @Patch('reopen')
  @RequirePermission('ATTENDANCE:REOPEN')
  reopen(@CurrentUser() user: JwtUserPayload, @Body() dto: ReopenAttendanceDto) {
    return this.attendanceService.reopen(user, dto);
  }
}

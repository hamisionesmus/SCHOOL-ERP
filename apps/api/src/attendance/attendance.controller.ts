import { BadRequestException, Body, Controller, Get, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ReopenAttendanceDto } from './dto/reopen-attendance.dto';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

  @Get('export')
  @RequirePermission('ATTENDANCE:MARK')
  async exportExcel(@CurrentUser() user: JwtUserPayload) {
    const buffer = await this.attendanceService.exportExcel(user);
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="attendance-export.xlsx"' });
  }

  @Get('import-template')
  @RequirePermission('ATTENDANCE:MARK')
  async importTemplate() {
    const buffer = await this.attendanceService.importTemplateExcel();
    return new StreamableFile(buffer, { type: XLSX_TYPE, disposition: 'attachment; filename="attendance-import-template.xlsx"' });
  }

  @Post('import')
  @RequirePermission('ATTENDANCE:MARK')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(@CurrentUser() user: JwtUserPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.attendanceService.importFromExcel(user, file.buffer);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  list(@CurrentUser() user: JwtUserPayload) {
    return this.calendarService.list(user);
  }

  @Post('events')
  @RequirePermission('CALENDAR:MANAGE')
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateEventDto) {
    return this.calendarService.create(user, dto);
  }

  @Delete('events/:id')
  @RequirePermission('CALENDAR:MANAGE')
  remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.calendarService.remove(user, id);
  }

  @Get('pdf')
  async pdf(
    @CurrentUser() user: JwtUserPayload,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const { buffer, filename } = await this.calendarService.monthPdf(user, Number(year), Number(month));
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('ics')
  async ics(@CurrentUser() user: JwtUserPayload) {
    const text = await this.calendarService.ics(user);
    return new StreamableFile(Buffer.from(text, 'utf-8'), {
      type: 'text/calendar',
      disposition: 'attachment; filename="school-calendar.ics"',
    });
  }
}

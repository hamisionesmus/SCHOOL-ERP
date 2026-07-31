import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { HomeworkService } from './homework.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';

@ApiTags('homework')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload, @Query('classId') classId?: string) {
    return this.homeworkService.list(user, classId);
  }

  @Post()
  @RequirePermission('HOMEWORK:ASSIGN')
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateAssignmentDto) {
    return this.homeworkService.create(user, dto);
  }

  @Post(':id/submissions')
  submit(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: SubmitHomeworkDto,
  ) {
    return this.homeworkService.submit(user, id, dto);
  }

  @Get(':id/submissions')
  @RequirePermission('HOMEWORK:VIEW')
  listSubmissions(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.homeworkService.listSubmissions(user, id);
  }
}

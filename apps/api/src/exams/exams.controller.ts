import { Body, Controller, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { ExamsService } from './exams.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { EnterMarksDto } from './dto/enter-marks.dto';
import { RejectExamSubjectDto } from './dto/reject-exam-subject.dto';

@ApiTags('exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get('exams')
  listExams(@CurrentUser() user: JwtUserPayload) {
    return this.examsService.listExams(user);
  }

  @Post('exams')
  @RequirePermission('EXAM:MANAGE')
  createExam(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateExamDto) {
    return this.examsService.createExam(user, dto);
  }

  @Post('exams/:examId/subjects')
  @RequirePermission('EXAM:MANAGE')
  createExamSubject(
    @CurrentUser() user: JwtUserPayload,
    @Param('examId') examId: string,
    @Body() dto: CreateExamSubjectDto,
  ) {
    return this.examsService.createExamSubject(user, examId, dto);
  }

  @Get('exams/:examId/report-card/:studentId')
  reportCard(
    @CurrentUser() user: JwtUserPayload,
    @Param('examId') examId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.examsService.reportCard(user, examId, studentId);
  }

  @Get('exams/:examId/report-card/:studentId/pdf')
  @Header('Content-Type', 'application/pdf')
  async reportCardPdf(
    @CurrentUser() user: JwtUserPayload,
    @Param('examId') examId: string,
    @Param('studentId') studentId: string,
  ) {
    const { buffer, filename } = await this.examsService.reportCardPdf(user, examId, studentId);
    return new StreamableFile(buffer, { disposition: `attachment; filename="${filename}"` });
  }

  @Get('exam-subjects')
  listExamSubjects(@CurrentUser() user: JwtUserPayload, @Query('examId') examId?: string) {
    return this.examsService.listExamSubjects(user, examId);
  }

  @Get('exam-subjects/:id/marks')
  getMarks(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.examsService.getMarks(user, id);
  }

  @Post('exam-subjects/:id/marks')
  enterMarks(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: EnterMarksDto) {
    return this.examsService.enterMarks(user, id, dto);
  }

  @Patch('exam-subjects/:id/submit')
  submit(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.examsService.submit(user, id);
  }

  @Patch('exam-subjects/:id/approve')
  @RequirePermission('EXAM:APPROVE')
  approve(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.examsService.approve(user, id);
  }

  @Patch('exam-subjects/:id/reject')
  @RequirePermission('EXAM:APPROVE')
  reject(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: RejectExamSubjectDto) {
    return this.examsService.reject(user, id, dto);
  }

  @Patch('exam-subjects/:id/reopen')
  @RequirePermission('EXAM:REOPEN')
  reopen(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.examsService.reopen(user, id);
  }
}

import { BadRequestException, Body, Controller, Get, Param, Patch, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AddGuardianDto } from './dto/add-guardian.dto';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.studentsService.list(user);
  }

  @Get('export')
  @RequirePermission('STUDENT:EDIT')
  async exportExcel(@CurrentUser() user: JwtUserPayload) {
    const buffer = await this.studentsService.exportExcel(user);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="students-export.xlsx"',
    });
  }

  @Get('import-template')
  @RequirePermission('STUDENT:EDIT')
  async importTemplate(@CurrentUser() user: JwtUserPayload) {
    const buffer = await this.studentsService.importTemplateExcel(user);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="students-import-template.xlsx"',
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.studentsService.findOne(user, id);
  }

  @Post()
  @RequirePermission('STUDENT:CREATE')
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('STUDENT:EDIT')
  update(@CurrentUser() user: JwtUserPayload, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(user, id, dto);
  }

  @Post(':id/guardians')
  @RequirePermission('STUDENT:EDIT')
  addGuardian(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: AddGuardianDto,
  ) {
    return this.studentsService.addGuardian(user, id, dto);
  }

  @Post('import')
  @RequirePermission('STUDENT:EDIT')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(@CurrentUser() user: JwtUserPayload, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.studentsService.importFromExcel(user, file.buffer);
  }
}

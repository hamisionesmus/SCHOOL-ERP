import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
}

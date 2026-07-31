import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateSchoolClassDto } from './dto/create-school-class.dto';
import { UpdateSchoolClassDto } from './dto/update-school-class.dto';

@ApiTags('academic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class AcademicController {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  @Get('grade-levels')
  gradeLevels(@CurrentUser() user: JwtUserPayload) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).gradeLevel.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get('academic-years')
  academicYears(@CurrentUser() user: JwtUserPayload) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).academicYear.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  // Gated behind TENANT:MANAGE_USERS (held by School Administrator) — a dedicated ACADEMIC:MANAGE
  // permission is planned alongside the full academic module in Phase 2 (see docs/RBAC.md).
  @Post('academic-years')
  @RequirePermission('TENANT:MANAGE_USERS')
  createAcademicYear(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateAcademicYearDto) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).academicYear.create({ data: dto });
  }

  @Get('classes')
  classes(@CurrentUser() user: JwtUserPayload) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).schoolClass.findMany({
      include: {
        gradeLevel: true,
        academicYear: true,
        classTeacher: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Post('classes')
  @RequirePermission('TENANT:MANAGE_USERS')
  createClass(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateSchoolClassDto) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).schoolClass.create({ data: dto });
  }

  // Every class should have exactly one class teacher of record — this is also what
  // AttendanceService/HomeworkService already enforce against (classTeacherId), so assigning it
  // here is what actually activates a teacher's ability to mark that class's attendance.
  @Patch('classes/:id')
  @RequirePermission('TENANT:MANAGE_USERS')
  updateClass(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolClassDto,
  ) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).schoolClass.update({
      where: { id },
      data: dto,
      include: {
        gradeLevel: true,
        academicYear: true,
        classTeacher: { select: { id: true, fullName: true, email: true } },
      },
    });
  }
}

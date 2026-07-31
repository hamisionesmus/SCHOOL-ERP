import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateSubjectAssignmentDto } from './dto/create-subject-assignment.dto';

@ApiTags('subjects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SubjectsController {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  @Get('subjects')
  list(@CurrentUser() user: JwtUserPayload) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).subject.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('subjects')
  @RequirePermission('EXAM:MANAGE')
  create(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateSubjectDto) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).subject.create({ data: dto });
  }

  @Get('subject-assignments')
  listAssignments(@CurrentUser() user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    // A teacher without EXAM:MANAGE only needs to see their own assignments (to know which classes'
    // marks they can enter); School Administrator sees all for setup purposes.
    const where = perms.includes('EXAM:MANAGE') ? {} : { teacherId: user.sub };
    return db.subjectAssignment.findMany({
      where,
      include: {
        subject: true,
        schoolClass: true,
        teacher: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('subject-assignments')
  @RequirePermission('EXAM:MANAGE')
  createAssignment(@CurrentUser() user: JwtUserPayload, @Body() dto: CreateSubjectAssignmentDto) {
    return this.tenantPrisma.forSchema(user.tenantSchema!).subjectAssignment.create({
      data: dto,
      include: { subject: true, schoolClass: true, teacher: { select: { id: true, fullName: true } } },
    });
  }
}

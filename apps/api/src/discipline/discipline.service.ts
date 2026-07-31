import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateCaseDto } from './dto/create-case.dto';

const CATEGORY_LABEL: Record<string, string> = {
  WARNING: 'received a warning',
  DETENTION: 'was given a detention',
  SUSPENSION: 'was suspended',
  POSITIVE_BEHAVIOR: 'was recognized for positive behavior',
};

@Injectable()
export class DisciplineService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly communications: CommunicationsService,
  ) {}

  async createCase(user: JwtUserPayload, dto: CreateCaseDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const student = await db.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const record = await db.disciplineCase.create({
      data: { ...dto, reportedByUserId: user.sub },
      include: { student: true },
    });

    const primaryGuardian = await db.guardianLink.findFirst({
      where: { studentId: dto.studentId, isPrimaryContact: true },
    });
    const recipientUserId = primaryGuardian?.guardianUserId ?? student.userId ?? undefined;
    if (recipientUserId) {
      const label = CATEGORY_LABEL[dto.category] ?? 'has a new discipline record';
      await this.communications.sendToUserId(
        user.tenantSchema!,
        recipientUserId,
        `${student.firstName} ${student.lastName} ${label} at school. ${dto.description}`,
      );
    }

    return record;
  }

  async listCases(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('DISCIPLINE:MANAGE')) {
      return db.disciplineCase.findMany({ include: { student: true }, orderBy: { createdAt: 'desc' } });
    }
    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.disciplineCase.findMany({
        where: { student: { guardians: { some: { guardianUserId: user.sub } } } },
        include: { student: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.disciplineCase.findMany({
        where: { student: { userId: user.sub } },
        include: { student: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    throw new ForbiddenException('No permission to view discipline cases');
  }
}

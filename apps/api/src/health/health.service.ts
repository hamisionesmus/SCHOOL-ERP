import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateMedicalAlertDto } from './dto/create-medical-alert.dto';
import { CreateClinicVisitDto } from './dto/create-clinic-visit.dto';

@Injectable()
export class HealthService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async createMedicalAlert(user: JwtUserPayload, dto: CreateMedicalAlertDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.medicalAlert.create({ data: dto });
  }

  async createClinicVisit(user: JwtUserPayload, dto: CreateClinicVisitDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.clinicVisit.create({ data: { ...dto, recordedByUserId: user.sub } });
  }

  private scopedWhere(user: JwtUserPayload) {
    const perms = user.permissions ?? [];
    if (perms.includes('HEALTH:MANAGE')) return {};
    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return { student: { guardians: { some: { guardianUserId: user.sub } } } };
    }
    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) return { student: { userId: user.sub } };
    throw new ForbiddenException('No permission to view health records');
  }

  async listMedicalAlerts(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.medicalAlert.findMany({
      where: this.scopedWhere(user),
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listClinicVisits(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.clinicVisit.findMany({
      where: this.scopedWhere(user),
      include: { student: true },
      orderBy: { visitDate: 'desc' },
    });
  }
}

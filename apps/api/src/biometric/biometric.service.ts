import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { LogBiometricEventDto } from './dto/log-biometric-event.dto';

const INCLUDE = {
  student: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
  staff: { select: { id: true, fullName: true, email: true } },
  loggedBy: { select: { id: true, fullName: true } },
} as const;

/**
 * An honest event-log stub: no on-device face/fingerprint matching happens here — a staff member
 * with BIOMETRIC:MANAGE logs an event through this API standing in for what a real device webhook
 * would post in production (see docs/SRS.md §4.9). The data model, retention (archived, never
 * hard-deleted — there is no DELETE route), and guardian/self-scoped visibility are all real.
 */
@Injectable()
export class BiometricService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  async logEvent(user: JwtUserPayload, dto: LogBiometricEventDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);

    if (dto.subjectType === 'STUDENT' && !dto.studentId) {
      throw new BadRequestException('studentId is required when subjectType is STUDENT');
    }
    if (dto.subjectType === 'STAFF' && !dto.staffUserId) {
      throw new BadRequestException('staffUserId is required when subjectType is STAFF');
    }
    if (dto.subjectType === 'STUDENT' && dto.method !== 'FACE') {
      throw new BadRequestException('Learners are scanned by FACE, not FINGERPRINT');
    }
    if (dto.subjectType === 'STAFF' && dto.method !== 'FINGERPRINT') {
      throw new BadRequestException('Staff are scanned by FINGERPRINT, not FACE');
    }

    const event = await db.biometricEvent.create({
      data: {
        subjectType: dto.subjectType,
        studentId: dto.subjectType === 'STUDENT' ? dto.studentId : undefined,
        staffUserId: dto.subjectType === 'STAFF' ? dto.staffUserId : undefined,
        method: dto.method,
        direction: dto.direction,
        note: dto.note,
        loggedByUserId: user.sub,
      },
      include: INCLUDE,
    });

    if (dto.subjectType === 'STUDENT' && dto.direction === 'OUT') {
      await this.notifyDeparture(user.tenantSchema!, dto.studentId!);
    }

    return event;
  }

  private async notifyDeparture(tenantSchema: string, studentId: string) {
    const db = this.tenantPrisma.forSchema(tenantSchema);
    const [student, guardians, assignment] = await Promise.all([
      db.student.findUnique({ where: { id: studentId } }),
      db.guardianLink.findMany({ where: { studentId }, distinct: ['guardianUserId'] }),
      db.transportAssignment.findUnique({ where: { studentId }, include: { route: true } }),
    ]);
    if (!student) return;

    const etaText = assignment?.route.estimatedMinutes
      ? ` Expected home in about ${assignment.route.estimatedMinutes} minutes.`
      : ' Please arrange pickup if not on a school route.';
    const body = `${student.firstName} ${student.lastName} has left school at ${new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}.${etaText}`;

    await Promise.all(
      guardians.map((g) => this.communicationsService.sendToUserId(tenantSchema, g.guardianUserId, body)),
    );
  }

  async list(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];

    if (perms.includes('BIOMETRIC:MANAGE')) {
      return db.biometricEvent.findMany({ include: INCLUDE, orderBy: { occurredAt: 'desc' }, take: 200 });
    }

    return db.biometricEvent.findMany({
      where: {
        OR: [
          { subjectType: 'STAFF' as const, staffUserId: user.sub },
          ...(perms.includes('STUDENT:VIEW_OWN_CHILD')
            ? [{ subjectType: 'STUDENT' as const, student: { guardians: { some: { guardianUserId: user.sub } } } }]
            : []),
          ...(perms.includes('STUDENT:VIEW_OWN_RECORD')
            ? [{ subjectType: 'STUDENT' as const, student: { userId: user.sub } }]
            : []),
        ],
      },
      include: INCLUDE,
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async archive(user: JwtUserPayload, id: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const event = await db.biometricEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Biometric event not found');
    return db.biometricEvent.update({ where: { id }, data: { archived: true }, include: INCLUDE });
  }
}

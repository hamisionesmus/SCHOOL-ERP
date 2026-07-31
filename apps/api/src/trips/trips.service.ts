import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { generateTripReceiptNumber } from './trip-receipt-number.util';
import { ProposeTripDto } from './dto/propose-trip.dto';
import { RejectTripDto } from './dto/reject-trip.dto';
import { RegisterTripDto } from './dto/register-trip.dto';
import { PayTripDto } from './dto/pay-trip.dto';

@Injectable()
export class TripsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly communications: CommunicationsService,
  ) {}

  async propose(user: JwtUserPayload, dto: ProposeTripDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.trip.create({
      data: {
        title: dto.title,
        description: dto.description,
        destination: dto.destination,
        tripDate: new Date(dto.tripDate),
        costPerStudent: dto.costPerStudent,
        proposedByUserId: user.sub,
      },
      include: { proposedBy: { select: { id: true, fullName: true } } },
    });
  }

  /** Everyone can see APPROVED trips (that's the whole point — parents browse and register); a
   * proposer can also see their own PROPOSED/REJECTED ones; TRANSPORT:MANAGE sees everything. */
  async listTrips(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const include = {
      proposedBy: { select: { id: true, fullName: true } },
      approvedBy: { select: { id: true, fullName: true } },
      registrations: true,
    } as const;

    if (perms.includes('TRANSPORT:MANAGE')) {
      return db.trip.findMany({ include, orderBy: { createdAt: 'desc' } });
    }
    return db.trip.findMany({
      where: { OR: [{ status: 'APPROVED' }, { proposedByUserId: user.sub }] },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(user: JwtUserPayload, tripId: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const trip = await db.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== 'PROPOSED') throw new BadRequestException('Only proposed trips can be approved');

    const updated = await db.trip.update({
      where: { id: tripId },
      data: { status: 'APPROVED', approvedByUserId: user.sub },
    });

    // Broadcast to every primary guardian in the school — the trip is now open for registration.
    const guardians = await db.guardianLink.findMany({
      where: { isPrimaryContact: true },
      distinct: ['guardianUserId'],
    });
    await Promise.all(
      guardians.map((g) =>
        this.communications.sendToUserId(
          user.tenantSchema!,
          g.guardianUserId,
          `New trip approved: "${trip.title}" to ${trip.destination} on ${trip.tripDate.toDateString()}. Cost: KES ${trip.costPerStudent}/student. Register on the parent portal.`,
        ),
      ),
    );

    return updated;
  }

  async reject(user: JwtUserPayload, tripId: string, dto: RejectTripDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const trip = await db.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== 'PROPOSED') throw new BadRequestException('Only proposed trips can be rejected');

    return db.trip.update({
      where: { id: tripId },
      data: { status: 'REJECTED', rejectionReason: dto.reason ?? null },
    });
  }

  private async assertGuardianOrStaff(user: JwtUserPayload, studentId: string) {
    const perms = user.permissions ?? [];
    if (perms.includes('TRANSPORT:MANAGE')) return;
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const isGuardian = await db.guardianLink.findFirst({ where: { studentId, guardianUserId: user.sub } });
    if (!isGuardian) throw new ForbiddenException("You can only manage your own children's trip registrations");
  }

  async register(user: JwtUserPayload, tripId: string, dto: RegisterTripDto) {
    await this.assertGuardianOrStaff(user, dto.studentId);
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const trip = await db.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== 'APPROVED') throw new BadRequestException('This trip is not open for registration');

    return db.tripRegistration.upsert({
      where: { tripId_studentId: { tripId, studentId: dto.studentId } },
      update: {},
      create: { tripId, studentId: dto.studentId },
      include: { student: true, trip: true },
    });
  }

  async listRegistrations(user: JwtUserPayload, tripId?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const where: Record<string, unknown> = tripId ? { tripId } : {};
    const include = { student: true, trip: true, payments: true } as const;

    if (perms.includes('TRANSPORT:MANAGE') || perms.includes('FINANCE:RECEIVE_PAYMENT')) {
      return db.tripRegistration.findMany({ where, include, orderBy: { createdAt: 'desc' } });
    }
    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.tripRegistration.findMany({
        where: { ...where, student: { guardians: { some: { guardianUserId: user.sub } } } },
        include,
        orderBy: { createdAt: 'desc' },
      });
    }
    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.tripRegistration.findMany({
        where: { ...where, student: { userId: user.sub } },
        include,
        orderBy: { createdAt: 'desc' },
      });
    }
    throw new ForbiddenException('No permission to view trip registrations');
  }

  async pay(user: JwtUserPayload, registrationId: string, dto: PayTripDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const registration = await db.tripRegistration.findUnique({
      where: { id: registrationId },
      include: { trip: true, student: true },
    });
    if (!registration) throw new NotFoundException('Trip registration not found');
    await this.assertGuardianOrStaff(user, registration.studentId);
    if (registration.status === 'PAID') throw new BadRequestException('This registration is already paid');
    if (dto.amount !== registration.trip.costPerStudent) {
      throw new BadRequestException(`Payment must be exactly KES ${registration.trip.costPerStudent}`);
    }

    const receiptNumber = await generateTripReceiptNumber(db);
    const payment = await db.tripPayment.create({
      data: {
        tripRegistrationId: registrationId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        receiptNumber,
        receivedByUserId: user.sub,
      },
    });
    await db.tripRegistration.update({ where: { id: registrationId }, data: { status: 'PAID' } });

    const primaryGuardian = await db.guardianLink.findFirst({
      where: { studentId: registration.studentId, isPrimaryContact: true },
    });
    const recipientUserId = primaryGuardian?.guardianUserId ?? registration.student.userId ?? undefined;
    if (recipientUserId) {
      await this.communications.sendToUserId(
        user.tenantSchema!,
        recipientUserId,
        `Payment of KES ${dto.amount} confirmed for ${registration.student.firstName} ${registration.student.lastName}'s trip "${registration.trip.title}". Receipt ${receiptNumber}.`,
      );
    }

    return payment;
  }
}

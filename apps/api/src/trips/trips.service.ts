import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { generateTripReceiptNumber } from './trip-receipt-number.util';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';
import { WorkflowRegistryService } from '../workflows/workflow-registry.service';
import type { PrismaClient } from '../../generated/tenant-client';
import { ProposeTripDto } from './dto/propose-trip.dto';
import { ReviewTripDto } from './dto/review-trip.dto';
import { RegisterTripDto } from './dto/register-trip.dto';
import { PayTripDto } from './dto/pay-trip.dto';

const TRIP_PROPOSAL_ENTITY_TYPE = 'TRIP_PROPOSAL';

@Injectable()
export class TripsService implements OnModuleInit {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly communications: CommunicationsService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
  ) {}

  /** Plugs Trip into the generic workflow engine — the only place TripsService and the engine touch
   * each other. TripStatus already matches the workflow's own APPROVED/REJECTED values exactly (no
   * domain-status mapping needed, unlike Admissions), so this just sets status + approvedByUserId and
   * — since "approved" is also the moment guardians need to hear about it, workflow-gated or not —
   * fires the same guardian broadcast the old direct approve() used to send inline. */
  onModuleInit() {
    this.workflowRegistry.registerHandler(TRIP_PROPOSAL_ENTITY_TYPE, async (entityId, finalStatus, actorUserId, tenantSchema) => {
      const db = this.tenantPrisma.forSchema(tenantSchema);
      if (finalStatus === 'APPROVED') {
        const trip = await db.trip.update({ where: { id: entityId }, data: { status: 'APPROVED', approvedByUserId: actorUserId } });
        await this.notifyGuardiansOfApproval(db, tenantSchema, trip);
      } else {
        await db.trip.update({ where: { id: entityId }, data: { status: 'REJECTED' } });
      }
    });
  }

  private async notifyGuardiansOfApproval(db: PrismaClient, tenantSchema: string, trip: { title: string; destination: string; tripDate: Date; costPerStudent: number }) {
    const guardians = await db.guardianLink.findMany({
      where: { isPrimaryContact: true },
      distinct: ['guardianUserId'],
    });
    await Promise.all(
      guardians.map((g) =>
        this.communications.sendToUserId(
          tenantSchema,
          g.guardianUserId,
          `New trip approved: "${trip.title}" to ${trip.destination} on ${trip.tripDate.toDateString()}. Cost: KES ${trip.costPerStudent}/student. Register on the parent portal.`,
        ),
      ),
    );
  }

  async propose(user: JwtUserPayload, dto: ProposeTripDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const trip = await db.trip.create({
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
    // Returns null when no active WorkflowDefinition exists for 'TRIP_PROPOSAL' — this school hasn't
    // configured an approval chain, so the trip just stays PROPOSED for direct TRANSPORT:MANAGE
    // review, exactly as before this engine existed.
    await this.workflowEngine.startInstance({ db, entityType: TRIP_PROPOSAL_ENTITY_TYPE, entityId: trip.id, user });
    return trip;
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

    const trips = perms.includes('TRANSPORT:MANAGE')
      ? await db.trip.findMany({ include, orderBy: { createdAt: 'desc' } })
      : await db.trip.findMany({
          where: { OR: [{ status: 'APPROVED' }, { proposedByUserId: user.sub }] },
          include,
          orderBy: { createdAt: 'desc' },
        });
    if (trips.length === 0) return trips;

    // WorkflowInstance isn't a Prisma relation of Trip (the engine is entity-agnostic — see
    // WorkflowEngineService) so it's fetched separately and attached in application code.
    const instances = await db.workflowInstance.findMany({
      where: { entityType: TRIP_PROPOSAL_ENTITY_TYPE, entityId: { in: trips.map((t) => t.id) } },
      include: {
        workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
        actions: { orderBy: { actedAt: 'asc' }, include: { actor: { select: { id: true, fullName: true } } } },
      },
    });
    const instanceByEntityId = new Map(instances.map((i) => [i.entityId, i]));
    return trips.map((t) => ({ ...t, workflowInstance: instanceByEntityId.get(t.id) ?? null }));
  }

  private async setDecision(user: JwtUserPayload, tripId: string, action: 'APPROVE' | 'REJECT', comment?: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const trip = await db.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const instance = await db.workflowInstance.findUnique({
      where: { entityType_entityId: { entityType: TRIP_PROPOSAL_ENTITY_TYPE, entityId: tripId } },
    });
    if (instance) {
      // WorkflowEngineService.recordAction() does its own precise permission check (holder of the
      // *current step's* permission code) and, on a terminal decision, calls the handler registered
      // in onModuleInit() above — which is what actually updates this Trip row and, on approval,
      // sends the guardian broadcast.
      await this.workflowEngine.recordAction(db, instance.id, user, action, comment);
      return db.trip.findUnique({ where: { id: tripId } });
    }

    // Fallback path — no workflow configured for this tenant, behaves exactly as before this engine
    // existed. The controller no longer gates these routes with @RequirePermission, so the check
    // moves here (same "authorization moved into the service" pattern already used by HrService).
    if (!(user.permissions ?? []).includes('TRANSPORT:MANAGE')) {
      throw new ForbiddenException('No permission to review trip proposals');
    }
    if (trip.status !== 'PROPOSED') {
      throw new BadRequestException(`Only proposed trips can be ${action === 'APPROVE' ? 'approved' : 'rejected'}`);
    }
    if (action === 'REJECT') {
      return db.trip.update({ where: { id: tripId }, data: { status: 'REJECTED', rejectionReason: comment ?? null } });
    }
    const updated = await db.trip.update({ where: { id: tripId }, data: { status: 'APPROVED', approvedByUserId: user.sub } });
    await this.notifyGuardiansOfApproval(db, user.tenantSchema!, updated);
    return updated;
  }

  approve(user: JwtUserPayload, tripId: string, comment?: string) {
    return this.setDecision(user, tripId, 'APPROVE', comment);
  }

  reject(user: JwtUserPayload, tripId: string, dto: ReviewTripDto) {
    return this.setDecision(user, tripId, 'REJECT', dto.comment);
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

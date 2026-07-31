import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { AssignTransportDto } from './dto/assign-transport.dto';

@Injectable()
export class TransportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async createVehicle(user: JwtUserPayload, dto: CreateVehicleDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.vehicle.create({ data: dto, include: { driver: { select: { id: true, fullName: true } } } });
  }

  async listVehicles(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.vehicle.findMany({
      include: { driver: { select: { id: true, fullName: true } } },
      orderBy: { plateNumber: 'asc' },
    });
  }

  async createRoute(user: JwtUserPayload, dto: CreateRouteDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.route.create({ data: dto, include: { vehicle: true } });
  }

  async listRoutes(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.route.findMany({
      include: { vehicle: { include: { driver: { select: { id: true, fullName: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async assignStudent(user: JwtUserPayload, dto: AssignTransportDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.transportAssignment.upsert({
      where: { studentId: dto.studentId },
      update: { routeId: dto.routeId },
      create: { studentId: dto.studentId, routeId: dto.routeId },
      include: { route: { include: { vehicle: true } }, student: true },
    });
  }

  async listAssignments(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const include = {
      route: { include: { vehicle: { include: { driver: { select: { id: true, fullName: true } } } } } },
      student: true,
    } as const;

    if (perms.includes('TRANSPORT:MANAGE')) {
      return db.transportAssignment.findMany({ include });
    }
    if (perms.includes('STUDENT:VIEW_OWN_CHILD')) {
      return db.transportAssignment.findMany({
        where: { student: { guardians: { some: { guardianUserId: user.sub } } } },
        include,
      });
    }
    if (perms.includes('STUDENT:VIEW_OWN_RECORD')) {
      return db.transportAssignment.findMany({ where: { student: { userId: user.sub } }, include });
    }
    throw new ForbiddenException('No permission to view transport assignments');
  }
}

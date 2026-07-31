import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

@Injectable()
export class HrService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async createLeaveRequest(user: JwtUserPayload, dto: CreateLeaveRequestDto) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    return db.leaveRequest.create({
      data: {
        requestedByUserId: user.sub,
        leaveType: dto.leaveType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
      },
    });
  }

  async listLeaveRequests(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const perms = user.permissions ?? [];
    const include = {
      requestedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true } },
    } as const;

    if (perms.includes('HR:EDIT')) {
      return db.leaveRequest.findMany({ include, orderBy: { createdAt: 'desc' } });
    }
    return db.leaveRequest.findMany({
      where: { requestedByUserId: user.sub },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async setStatus(user: JwtUserPayload, id: string, status: 'APPROVED' | 'REJECTED') {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const request = await db.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('This request was already reviewed');

    return db.leaveRequest.update({
      where: { id },
      data: { status, reviewedByUserId: user.sub },
    });
  }

  approve(user: JwtUserPayload, id: string) {
    return this.setStatus(user, id, 'APPROVED');
  }

  reject(user: JwtUserPayload, id: string) {
    return this.setStatus(user, id, 'REJECTED');
  }
}

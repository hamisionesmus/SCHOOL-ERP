import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';

@Injectable()
export class SecurityService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async listAlerts(page = 1, pageSize = 20) {
    const [data, total, unacknowledgedCount, highSeverityUnacknowledgedCount] = await Promise.all([
      this.platformPrisma.securityAlert.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.securityAlert.count(),
      this.platformPrisma.securityAlert.count({ where: { acknowledged: false } }),
      this.platformPrisma.securityAlert.count({ where: { acknowledged: false, severity: 'HIGH' } }),
    ]);
    return { data, meta: { page, pageSize, total, unacknowledgedCount, highSeverityUnacknowledgedCount } };
  }

  async acknowledge(id: string) {
    const alert = await this.platformPrisma.securityAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    return this.platformPrisma.securityAlert.update({ where: { id }, data: { acknowledged: true } });
  }
}

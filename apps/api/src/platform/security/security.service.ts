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

  /** Login-request visibility: total successful vs failed counts (all-time), plus the most recent of
   * each — failed attempts include ones from emails that don't exist anywhere in the system at all
   * (see AuthService.login(), which records a FailedLoginAttempt even before resolving which realm
   * to check), and successful ones flag whether that (user, IP, device) combo has been seen before. */
  async loginActivity(page = 1, pageSize = 20) {
    const [totalSuccessful, totalFailed, successful, failed] = await Promise.all([
      this.platformPrisma.loginEvent.count(),
      this.platformPrisma.failedLoginAttempt.count(),
      this.platformPrisma.loginEvent.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.failedLoginAttempt.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { totalSuccessful, totalFailed, successful, failed, meta: { page, pageSize } };
  }
}

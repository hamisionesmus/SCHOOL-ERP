import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async getSettings(user: JwtUserPayload) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { schemaName: user.tenantSchema!, deletedAt: null },
      include: { subscriptionPlan: true },
    });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  async updateSettings(user: JwtUserPayload, dto: UpdateSettingsDto) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { schemaName: user.tenantSchema!, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('School not found');

    return this.platformPrisma.tenant.update({ where: { id: tenant.id }, data: dto });
  }
}

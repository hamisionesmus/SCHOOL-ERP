import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';
import { seedTenantCore } from '../../common/tenant-seed/seed-data';

@Injectable()
export class TenantsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly provisioning: TenantProvisioningService,
  ) {}

  async list(page = 1, pageSize = 20) {
    const [data, total] = await Promise.all([
      this.platformPrisma.tenant.findMany({
        where: { deletedAt: null },
        include: { subscriptionPlan: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.tenant.count({ where: { deletedAt: null } }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async findOne(id: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.platformPrisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('A school with this slug already exists');

    const schemaName = `tenant_${dto.slug.replace(/-/g, '_')}`;

    const tenant = await this.platformPrisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        schemaName,
        address: dto.address,
        website: dto.website,
        smsSenderId: dto.smsSenderId,
        status: 'ACTIVE',
      },
    });

    await this.provisioning.provisionSchema(schemaName);

    const db = this.tenantPrisma.forSchema(schemaName);
    await seedTenantCore(db, {
      email: dto.adminEmail,
      fullName: dto.adminFullName,
      password: dto.adminPassword,
    });

    return tenant;
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.platformPrisma.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.platformPrisma.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async updatePaymentConfig(id: string, dto: UpdatePaymentConfigDto) {
    await this.findOne(id);
    return this.platformPrisma.tenant.update({ where: { id }, data: dto });
  }
}

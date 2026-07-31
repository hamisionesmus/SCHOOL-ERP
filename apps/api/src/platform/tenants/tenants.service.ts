import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';
import { seedTenantCore } from '../../common/tenant-seed/seed-data';

function directorySizeBytes(dir: string): number {
  let total = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    total += stat.isDirectory() ? directorySizeBytes(full) : stat.size;
  }
  return total;
}

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

  /** Real usage, not an estimate: sums pg_total_relation_size across every table in the tenant's
   * Postgres schema (works cross-schema within the same database/cluster — no per-schema size
   * function exists in Postgres, so this is the standard way to compute it) plus the byte size of
   * the tenant's local-disk uploads folder. See docs/SRS.md §4.1 for what the Super Admin sees. */
  async getUsage(id: string) {
    const tenant = await this.findOne(id);

    const dbSizeResult = await this.platformPrisma.$queryRaw<{ bytes: bigint | null }[]>`
      SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0) AS bytes
      FROM pg_tables
      WHERE schemaname = ${tenant.schemaName}
    `;
    const databaseBytes = Number(dbSizeResult[0]?.bytes ?? 0);
    const uploadsBytes = directorySizeBytes(join(process.cwd(), 'uploads', tenant.schemaName));
    const totalBytes = databaseBytes + uploadsBytes;
    const limitMb = tenant.storageLimitMbOverride ?? null;

    return {
      databaseBytes,
      uploadsBytes,
      totalBytes,
      totalMb: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
      limitMb,
      usagePct: limitMb ? Math.round(((totalBytes / 1024 / 1024) / limitMb) * 1000) / 10 : null,
    };
  }
}

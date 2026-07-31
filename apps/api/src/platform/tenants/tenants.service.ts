import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { RequestTenantDto } from './dto/request-tenant.dto';
import { ConfirmTenantDto } from './dto/confirm-tenant.dto';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';
import { seedTenantCore } from '../../common/tenant-seed/seed-data';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { SMS_PROVIDER, SmsProvider } from '../../communications/providers/sms-provider.interface';

const CREATION_CODE_TTL_MS = 15 * 60 * 1000;

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
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
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

  /** Step 1 of tenant creation: stores the request with a 6-digit confirmation code (15-minute
   * expiry) and emails the code to the *requesting Super Admin's own* registered email — not the new
   * school's admin. Nothing is provisioned yet. This exists so a compromised or unattended Super
   * Admin session can't silently spin up a school; see docs/SRS.md §4.1. The code is also returned in
   * the response (`devCode`) as a testing convenience, the same way the password-reset flow surfaces
   * its one-time temp password — there is no real email/SMS gateway in this environment to rely on. */
  async requestCreate(dto: RequestTenantDto, requestedByUserId: string) {
    const existing = await this.platformPrisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('A school with this slug already exists');
    if (dto.isDemo && !dto.demoDurationHours) {
      throw new BadRequestException('demoDurationHours is required for a demo account');
    }

    const requester = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedByUserId } });
    if (!requester) throw new UnauthorizedException();

    const code = String(randomInt(100_000, 1_000_000));
    const adminPasswordHash = await bcrypt.hash(dto.adminPassword, 12);

    const request = await this.platformPrisma.tenantCreationRequest.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        code,
        requestedById: requestedByUserId,
        adminFullName: dto.adminFullName,
        adminEmail: dto.adminEmail,
        adminPhone: dto.adminPhone,
        adminPasswordHash,
        planId: dto.planId,
        isDemo: !!dto.isDemo,
        demoDurationHours: dto.demoDurationHours,
        expiresAt: new Date(Date.now() + CREATION_CODE_TTL_MS),
      },
    });

    await this.emailProvider.send(
      requester.email,
      `Confirm school creation: ${dto.name}`,
      `Someone requested to create "${dto.name}" (${dto.slug})${dto.isDemo ? ` as a ${dto.demoDurationHours}-hour demo account` : ''} on your Super Admin account. If this was you, enter code ${code} to confirm. It expires in 15 minutes. If you didn't request this, ignore this message — nothing is created until the code is confirmed.`,
    );

    return { requestId: request.id, expiresAt: request.expiresAt, devCode: code };
  }

  /** Step 2: validates the code and actually provisions the school. Only now does the schema get
   * created and the admin user get seeded. */
  async confirmCreate(dto: ConfirmTenantDto) {
    const request = await this.platformPrisma.tenantCreationRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Creation request not found');
    if (request.consumedAt) throw new BadRequestException('This request has already been used');
    if (request.expiresAt < new Date()) throw new BadRequestException('This code has expired — start over');
    if (request.code !== dto.code) throw new BadRequestException('Incorrect code');

    const schemaName = `tenant_${request.slug.replace(/-/g, '_')}`;
    const demoExpiresAt = request.isDemo
      ? new Date(Date.now() + (request.demoDurationHours ?? 24) * 3_600_000)
      : null;

    const tenant = await this.platformPrisma.tenant.create({
      data: {
        name: request.name,
        slug: request.slug,
        schemaName,
        status: 'ACTIVE',
        subscriptionPlanId: request.planId ?? undefined,
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        isDemo: request.isDemo,
        demoExpiresAt,
      },
    });

    await this.provisioning.provisionSchema(schemaName);

    const db = this.tenantPrisma.forSchema(schemaName);
    await seedTenantCore(db, {
      email: request.adminEmail,
      fullName: request.adminFullName,
      passwordHash: request.adminPasswordHash,
    });

    await this.platformPrisma.tenantCreationRequest.update({
      where: { id: request.id },
      data: { consumedAt: new Date() },
    });

    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    if (request.isDemo) {
      const expiryText = demoExpiresAt!.toLocaleString('en-KE');
      const body = `Welcome to School ERP! Your demo school "${request.name}" is ready.\n\nSign in at ${loginUrl}\nSchool code: ${request.slug}\nEmail: ${request.adminEmail}\n\nThis demo account expires on ${expiryText} — after that, sign-in will be blocked until the Super Admin extends or converts it to a full subscription.`;
      await this.emailProvider.send(request.adminEmail, `Welcome to School ERP — your ${request.name} demo is ready`, body);
      if (request.adminPhone) {
        await this.smsProvider.send(
          request.adminPhone,
          `Welcome to School ERP! Your "${request.name}" demo is ready. Sign in at ${loginUrl} with ${request.adminEmail}. Expires ${expiryText}.`,
        );
      }
    } else {
      await this.emailProvider.send(
        request.adminEmail,
        `Welcome to School ERP — ${request.name} is ready`,
        `Welcome to School ERP! "${request.name}" has been created.\n\nSign in at ${loginUrl}\nSchool code: ${request.slug}\nEmail: ${request.adminEmail}\n\nYou'll be asked to review your school's settings the first time you sign in.`,
      );
    }

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

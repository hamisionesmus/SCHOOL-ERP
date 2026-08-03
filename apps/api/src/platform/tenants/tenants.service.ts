import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { readdirSync, statSync, rmSync } from 'node:fs';
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
import { UserDirectoryService } from '../../common/user-directory/user-directory.service';
import { ActivationService } from '../activation/activation.service';
import { generateInvoiceNumber } from '../billing/invoice-number.util';
import { CYCLE_DAYS } from '../billing/cycle.util';
import { generateTempPassword } from '../../common/password.util';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PricingTiersService } from '../pricing-tiers/pricing-tiers.service';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';

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
    private readonly userDirectory: UserDirectoryService,
    private readonly activationService: ActivationService,
    private readonly notifier: PlatformNotifierService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly pricingTiers: PricingTiersService,
  ) {}

  // Sub-Admins only see schools they personally created; every other role (Super Admin, Assistant
  // Super Admin) sees the full platform — Assistant Super Admin deliberately keeps full visibility
  // per its existing "sits above Sub-Admin" design (see PlatformRole doc comment in schema.prisma).
  private scopeToOwnSchools(user?: JwtUserPayload) {
    return user?.role === 'SUB_ADMIN' ? { createdById: user.sub } : {};
  }

  async list(page = 1, pageSize = 20, q?: string, user?: JwtUserPayload) {
    const where = {
      deletedAt: null,
      ...this.scopeToOwnSchools(user),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { slug: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.platformPrisma.tenant.findMany({
        where,
        include: { subscriptionPlan: true, createdBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.tenant.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async findOne(id: string, user?: JwtUserPayload) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { id, deletedAt: null, ...this.scopeToOwnSchools(user) },
      include: { createdBy: { select: { fullName: true } } },
    });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  /** Step 1 of tenant creation: stores the request with two independent 6-digit codes (15-minute
   * expiry) — one confirming the request itself, the other texted+emailed to the *new school's
   * admin* (proves that contact is real and they consent). Nothing is provisioned until both codes
   * are confirmed together.
   *
   * Who the first code goes to depends on the requester's role: a SUPER_ADMIN gets it on their own
   * registered email/phone (proves it's really them, not a compromised/unattended session — see
   * docs/SRS.md §4.1). A SUB_ADMIN can start a school-creation request but the code never reaches
   * them — it's sent to every real SUPER_ADMIN instead, so a delegated admin can never provision a
   * school without the actual owner's sign-off.
   *
   * Both codes are echoed back in the response (`devCode`/`devAdminOtp`) purely as a local-dev
   * convenience while no real email/SMS provider is configured (see
   * PlatformSettingsService.isEmailConfigured()). `devCode` is additionally NEVER returned to a
   * Sub-Admin requester regardless of that setting — it isn't their code to see. */
  async requestCreate(dto: RequestTenantDto, requestedByUserId: string) {
    const existing = await this.platformPrisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new BadRequestException('A school with this slug already exists');

    const isDemo = dto.accountType === 'demo' || dto.accountType === 'test';
    const isTest = dto.accountType === 'test';
    const isReal = dto.accountType === 'real';

    if (isDemo && !dto.demoDurationHours) {
      throw new BadRequestException('demoDurationHours is required for a demo or test account');
    }
    if (isReal && !dto.activationBillingCycle) {
      throw new BadRequestException('activationBillingCycle is required for a real school');
    }
    if (isReal && (dto.studentCount == null || dto.teacherCount == null || dto.nonTeachingStaffCount == null)) {
      throw new BadRequestException('studentCount, teacherCount, and nonTeachingStaffCount are required for a real school');
    }

    // Server-computed, never trusted from the client — see PricingTiersService.computeFee(). The
    // frontend's displayed "estimated fee" is only a preview using the same tier list.
    const activationFeeKes = isReal
      ? await this.pricingTiers.computeFee(
          (dto.studentCount ?? 0) + (dto.teacherCount ?? 0) + (dto.nonTeachingStaffCount ?? 0),
        )
      : undefined;

    const requester = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedByUserId } });
    if (!requester) throw new UnauthorizedException();

    const code = String(randomInt(100_000, 1_000_000));
    const adminOtpCode = String(randomInt(100_000, 1_000_000));
    const adminPasswordHash = await bcrypt.hash(dto.adminPassword, 12);

    const request = await this.platformPrisma.tenantCreationRequest.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        code,
        adminOtpCode,
        requestedById: requestedByUserId,
        adminFullName: dto.adminFullName,
        adminEmail: dto.adminEmail,
        adminPhone: dto.adminPhone,
        adminPasswordHash,
        planId: dto.planId,
        isDemo,
        isTest,
        demoDurationHours: dto.demoDurationHours,
        activationFeeKes,
        activationBillingCycle: isReal ? dto.activationBillingCycle : undefined,
        studentCount: dto.studentCount,
        teacherCount: dto.teacherCount,
        nonTeachingStaffCount: dto.nonTeachingStaffCount,
        county: dto.county,
        town: dto.town,
        expiresAt: new Date(Date.now() + CREATION_CODE_TTL_MS),
      },
    });

    const isSubAdmin = requester.role === 'SUB_ADMIN';
    const codeRecipients = isSubAdmin
      ? await this.platformPrisma.platformUser.findMany({ where: { role: 'SUPER_ADMIN', deletedAt: null } })
      : [requester];
    for (const recipient of codeRecipients) {
      await this.notifier.notify('OTP_SUPERADMIN', {
        to: { email: recipient.email, phone: recipient.phone },
        vars: {
          schoolName: dto.name,
          slug: dto.slug,
          code,
          demoNote: isDemo ? ` as a ${dto.demoDurationHours}-hour ${isTest ? 'test' : 'demo'} account` : '',
          requestedByName: requester.fullName,
        },
      });
    }
    await this.notifier.notify('OTP_ADMIN', {
      to: { email: dto.adminEmail, phone: dto.adminPhone },
      vars: { schoolName: dto.name, otpCode: adminOtpCode, creatorLabel: requester.fullName },
    });

    const emailConfigured = await this.platformSettings.isEmailConfigured();
    return {
      requestId: request.id,
      expiresAt: request.expiresAt,
      devCode: !emailConfigured && !isSubAdmin ? code : undefined,
      devAdminOtp: !emailConfigured ? adminOtpCode : undefined,
    };
  }

  /** Step 2: validates both codes and actually provisions the school. Only now does the schema get
   * created and the admin user get seeded. */
  async confirmCreate(dto: ConfirmTenantDto) {
    const request = await this.platformPrisma.tenantCreationRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Creation request not found');
    if (request.consumedAt) throw new BadRequestException('This request has already been used');
    if (request.expiresAt < new Date()) throw new BadRequestException('This code has expired — start over');
    if (request.code !== dto.code) throw new BadRequestException('Incorrect confirmation code');
    if (request.adminOtpCode !== dto.adminOtpCode) throw new BadRequestException("Incorrect admin OTP code");

    const schemaName = `tenant_${request.slug.replace(/-/g, '_')}`;
    const demoExpiresAt = request.isDemo
      ? new Date(Date.now() + (request.demoDurationHours ?? 24) * 3_600_000)
      : null;
    const billingCycle = request.activationBillingCycle ?? 'MONTHLY';

    // Demo accounts stay free/expiry-based and are usable immediately (ACTIVE). Real accounts are
    // created locked (PENDING_PAYMENT) — login is blocked (see AuthService.login) until the school
    // pays the activation fee via M-Pesa STK push from the link in the welcome email below.
    const tenant = await this.platformPrisma.tenant.create({
      data: {
        name: request.name,
        slug: request.slug,
        schemaName,
        status: request.isDemo ? 'ACTIVE' : 'PENDING_PAYMENT',
        subscriptionPlanId: request.planId ?? undefined,
        billingCycle,
        currentPeriodEnd: request.isDemo ? new Date(Date.now() + 30 * 86_400_000) : null,
        isDemo: request.isDemo,
        isTest: request.isTest,
        demoExpiresAt,
        contactEmail: request.adminEmail,
        contactPhone: request.adminPhone,
        county: request.county,
        town: request.town,
        createdById: request.requestedById,
      },
    });

    await this.provisioning.provisionSchema(schemaName);
    await this.userDirectory.reserveForSchema(request.adminEmail, schemaName);

    const db = this.tenantPrisma.forSchema(schemaName);
    const adminUser = await seedTenantCore(db, {
      email: request.adminEmail,
      fullName: request.adminFullName,
      passwordHash: request.adminPasswordHash,
    });

    await this.platformPrisma.tenantCreationRequest.update({
      where: { id: request.id },
      data: { consumedAt: new Date(), adminOtpVerifiedAt: new Date() },
    });

    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    if (request.isDemo) {
      // Demo is usable immediately — hand over real, working credentials rather than the
      // Super-Admin-typed password (which is never otherwise communicated to the actual admin).
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await db.user.update({ where: { id: adminUser.id }, data: { passwordHash } });

      const expiryText = demoExpiresAt!.toLocaleString('en-KE');
      await this.notifier.notify('WELCOME_DEMO', {
        to: { email: request.adminEmail, phone: request.adminPhone },
        vars: { schoolName: request.name, loginUrl, email: request.adminEmail, tempPassword, expiryDate: expiryText },
      });
    } else {
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + CYCLE_DAYS[billingCycle] * 86_400_000);
      const amountKes = Math.round(Number(request.activationFeeKes ?? 0));
      const invoiceNumber = await generateInvoiceNumber(this.platformPrisma);
      const invoice = await this.platformPrisma.platformInvoice.create({
        data: {
          tenantId: tenant.id,
          billingCycle,
          periodStart,
          periodEnd,
          amount: amountKes,
          dueDate: new Date(periodStart.getTime() + 7 * 86_400_000),
          invoiceNumber,
        },
      });
      const activationToken = await this.activationService.signActivationToken(tenant.id, invoice.id);
      const activationUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/activate/${activationToken}`;

      await this.notifier.notify('WELCOME_REAL', {
        to: { email: request.adminEmail, phone: request.adminPhone },
        vars: {
          schoolName: request.name,
          activationUrl,
          amountKes: amountKes.toLocaleString(),
          loginUrl,
          slug: request.slug,
          email: request.adminEmail,
        },
      });
    }

    return tenant;
  }

  /** Re-derives a fresh activation link for a PENDING_PAYMENT tenant — for the Super Admin to copy
   * and manually resend if the original welcome email didn't arrive. Signing is deterministic given
   * the same tenantId+invoiceId (see ActivationService), so this doesn't need to persist anything;
   * both the original and any freshly-derived link work until they expire (30 days). */
  async getActivationLink(id: string) {
    const tenant = await this.findOne(id);
    if (tenant.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('This school is already active — no activation link needed');
    }
    const invoice = await this.platformPrisma.platformInvoice.findFirst({
      where: { tenantId: id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    if (!invoice) throw new NotFoundException('No pending activation invoice found for this school');

    const token = await this.activationService.signActivationToken(tenant.id, invoice.id);
    return {
      url: `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/activate/${token}`,
      amountKes: invoice.amount,
    };
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

  /** Permanently removes a Test tenant — schema, uploads, and every platform-schema row that
   * references it. Hard-guarded to isTest tenants only, unconditionally (not just a UI affordance):
   * a Demo or Real tenant can never reach this path even via a direct API call. Sub-Admins and
   * Assistant Super Admins may only delete tenants they themselves created; Super Admin can delete
   * any test tenant — same visibility boundary as scopeToOwnSchools(). */
  async deleteTestTenant(id: string, user: JwtUserPayload) {
    const tenant = await this.platformPrisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('School not found');
    if (!tenant.isTest) {
      throw new BadRequestException('Only Test accounts can be deleted — Demo and Real schools must be suspended instead');
    }
    if (user.role !== 'SUPER_ADMIN' && tenant.createdById !== user.sub) {
      throw new BadRequestException('You can only delete test schools you created yourself');
    }

    await this.platformPrisma.$transaction([
      this.platformPrisma.platformPayment.deleteMany({ where: { invoice: { tenantId: id } } }),
      this.platformPrisma.platformMpesaStkRequest.deleteMany({ where: { tenantId: id } }),
      this.platformPrisma.platformPaymentProof.deleteMany({ where: { tenantId: id } }),
      this.platformPrisma.platformInvoice.deleteMany({ where: { tenantId: id } }),
      this.platformPrisma.tenantFeedback.deleteMany({ where: { tenantId: id } }),
      this.platformPrisma.platformTicketEscalation.deleteMany({ where: { tenantId: id } }),
      this.platformPrisma.auditLogAccessRequest.deleteMany({ where: { tenantId: id } }),
      this.platformPrisma.tenant.delete({ where: { id } }),
    ]);

    await this.platformPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
    try {
      rmSync(join(process.cwd(), 'uploads', tenant.schemaName), { recursive: true, force: true });
    } catch {
      // Best-effort — a missing uploads folder (e.g. school never uploaded anything) isn't an error.
    }

    return { deleted: true };
  }
}

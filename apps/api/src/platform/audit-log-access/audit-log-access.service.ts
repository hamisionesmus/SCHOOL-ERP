import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

const CODE_TTL_MS = 15 * 60 * 1000;
const ACCESS_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

function toCsv(rows: { id: string; actor: { fullName: string; email: string } | null; action: string; entityType: string; entityId: string | null; createdAt: Date }[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = 'id,actorName,actorEmail,action,entityType,entityId,createdAt';
  const lines = rows.map((r) =>
    [r.id, r.actor?.fullName ?? '', r.actor?.email ?? '', r.action, r.entityType, r.entityId ?? '', r.createdAt.toISOString()]
      .map((v) => esc(String(v)))
      .join(','),
  );
  return [header, ...lines].join('\n');
}

/**
 * Time-delayed, per-school audit-log access. Deliberately more friction than the tenant-creation
 * code flow: confirming the code doesn't grant access immediately, it only *starts* a mandatory
 * 2-hour delay before the log file can be assembled and downloaded. Always scoped to exactly one
 * tenant — there is no cross-school export anywhere in this module.
 */
@Injectable()
export class AuditLogAccessService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private async findTenant(tenantId: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    return tenant;
  }

  async request(tenantId: string, requestedById: string) {
    const tenant = await this.findTenant(tenantId);
    const requester = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedById } });
    if (!requester) throw new UnauthorizedException();

    const code = String(randomInt(100_000, 1_000_000));
    const request = await this.platformPrisma.auditLogAccessRequest.create({
      data: {
        tenantId,
        requestedById,
        code,
        codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.emailProvider.send(
      requester.email,
      `Confirm audit-log access request: ${tenant.name}`,
      `You requested access to ${tenant.name}'s (${tenant.slug}) activity log. Enter code ${code} to confirm — it expires in 15 minutes. Once confirmed, the log itself won't be available to download for 2 hours; this delay is intentional. If you didn't request this, ignore this message.`,
    );

    const emailConfigured = await this.platformSettings.isEmailConfigured();
    return { requestId: request.id, expiresAt: request.codeExpiresAt, devCode: emailConfigured ? undefined : code };
  }

  async confirm(requestId: string, code: string) {
    const request = await this.platformPrisma.auditLogAccessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.confirmedAt) throw new BadRequestException('This request has already been confirmed');
    if (request.codeExpiresAt < new Date()) throw new BadRequestException('This code has expired — start over');
    if (request.code !== code) throw new BadRequestException('Incorrect code');

    const availableAt = new Date(Date.now() + ACCESS_DELAY_MS);
    return this.platformPrisma.auditLogAccessRequest.update({
      where: { id: requestId },
      data: { confirmedAt: new Date(), availableAt },
    });
  }

  async status(requestId: string) {
    const request = await this.platformPrisma.auditLogAccessRequest.findUnique({
      where: { id: requestId },
      include: { tenant: { select: { name: true, slug: true } } },
    });
    if (!request) throw new NotFoundException('Request not found');
    const ready = !!request.availableAt && request.availableAt <= new Date();
    return { ...request, ready };
  }

  private async assembleCsv(tenantId: string): Promise<{ csv: string; tenant: { name: string; slug: string; schemaName: string } }> {
    const tenant = await this.findTenant(tenantId);
    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const rows = await db.auditLog.findMany({
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { csv: toCsv(rows), tenant };
  }

  async download(requestId: string): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.platformPrisma.auditLogAccessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (!request.confirmedAt) throw new ForbiddenException('This request has not been confirmed with its code yet');
    if (!request.availableAt || request.availableAt > new Date()) {
      throw new ForbiddenException(
        `Not yet available — ready at ${request.availableAt?.toLocaleString('en-KE') ?? 'unknown'}`,
      );
    }

    const { csv, tenant } = await this.assembleCsv(request.tenantId);
    await this.platformPrisma.auditLogAccessRequest.update({ where: { id: requestId }, data: { downloadedAt: new Date() } });

    return {
      buffer: Buffer.from(csv, 'utf-8'),
      filename: `${tenant.slug}-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  /** Emails the assembled log (as an attachment) to that specific school's own School Administrator
   * — never to anyone else, and never bundled with another school's data. */
  async shareWithSchool(requestId: string) {
    const request = await this.platformPrisma.auditLogAccessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (!request.availableAt || request.availableAt > new Date()) {
      throw new ForbiddenException('Not yet available for this request');
    }

    const { csv, tenant } = await this.assembleCsv(request.tenantId);
    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const admin = await db.user.findFirst({
      where: { deletedAt: null, userRoles: { some: { role: { name: 'School Administrator' } } } },
      select: { email: true, fullName: true },
    });
    if (!admin) throw new NotFoundException('No School Administrator found for this school');

    const filename = `${tenant.slug}-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    await this.emailProvider.send(
      admin.email,
      `Activity log for ${tenant.name}`,
      `Attached is your school's activity log, shared by the platform Super Admin.`,
      [{ filename, content: Buffer.from(csv, 'utf-8'), contentType: 'text/csv' }],
    );

    await this.platformPrisma.auditLogAccessRequest.update({
      where: { id: requestId },
      data: { sharedWithSchoolAt: new Date() },
    });
    return { ok: true, sharedWith: admin.email };
  }

  async listForTenant(tenantId: string) {
    return this.platformPrisma.auditLogAccessRequest.findMany({
      where: { tenantId },
      include: { requestedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

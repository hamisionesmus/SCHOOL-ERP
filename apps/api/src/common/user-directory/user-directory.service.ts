import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformPrismaService } from '../prisma/platform-prisma.service';

const GENERIC_IN_USE_MESSAGE = 'This email is already in use elsewhere in the system and cannot be used again.';

// Keeps the platform-wide email → school lookup in sync so login can resolve which school an
// email belongs to without asking the user to type a school slug (see AuthService.login()). Every
// place that creates a tenant-side User calls reserveForSchema() first — see
// users.controller.ts, admissions.service.ts, students.service.ts, and tenant-seed/seed-data.ts.
// Takes a schemaName (always known wherever a tenant User is being created, since it's literally
// the DB connection context) rather than a tenantId, resolving the Tenant row internally.
@Injectable()
export class UserDirectoryService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  /** Claims an email for a tenant (by schema), or confirms it's already claimed by that same
   * tenant. Throws if another school already has this email — enforces platform-wide email
   * uniqueness. */
  async reserveForSchema(email: string, schemaName: string): Promise<void> {
    const tenant = await this.platformPrisma.tenant.findUnique({ where: { schemaName } });
    if (!tenant) throw new NotFoundException('School not found');

    const existing = await this.platformPrisma.userDirectoryEntry.findUnique({ where: { email } });
    if (existing && existing.tenantId !== tenant.id) {
      throw new ConflictException(
        `${email} is already registered at another school. Each email can only belong to one school across the platform.`,
      );
    }
    if (!existing) {
      await this.platformPrisma.userDirectoryEntry.create({ data: { email, tenantId: tenant.id } });
    }
  }

  /** Returns the school's slug for an email, or null if the email isn't registered at any
   * school — used by login to auto-resolve which tenant to check without a manually-entered slug. */
  async findTenantSlugByEmail(email: string): Promise<string | null> {
    const entry = await this.platformPrisma.userDirectoryEntry.findUnique({
      where: { email },
      include: { tenant: { select: { slug: true } } },
    });
    return entry?.tenant.slug ?? null;
  }

  /** Platform-wide email uniqueness gate for anyone about to become a NEW account — a new school's
   * admin, or a new Sub-Admin/Assistant Super Admin — checked against BOTH directories, since
   * reserveForSchema() alone only guards tenant-to-tenant collisions and PlatformAdminsService's own
   * check alone only guarded platform-to-platform ones; neither previously checked the other. Not
   * used for login/existing-account lookups, only account-creation gates. */
  async assertEmailNotInUse(email: string): Promise<void> {
    const [directoryEntry, platformUser] = await Promise.all([
      this.platformPrisma.userDirectoryEntry.findUnique({ where: { email } }),
      this.platformPrisma.platformUser.findUnique({ where: { email } }),
    ]);
    if (directoryEntry || platformUser) throw new ConflictException(GENERIC_IN_USE_MESSAGE);
  }
}

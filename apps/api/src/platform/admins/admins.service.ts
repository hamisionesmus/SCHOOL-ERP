import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { generateTempPassword } from '../../common/password.util';
import { UserDirectoryService } from '../../common/user-directory/user-directory.service';
import { InviteAdminDto } from './dto/invite-admin.dto';

// Same allow-list as PermissionsGuard's ADMIN_TIER_ROLES — this page/endpoint is specifically the
// "Admins" screen (invite/deactivate/role-manage delegated admins), never a general user directory.
// Without this filter, TRAINER/GIG_WORKER/SOFTWARE_ENGINEER/STAFF accounts leak in here and render
// mislabeled (Badge falls back to unstyled/grey, reading as a Sub-Admin) — see PlatformAdminsController.
export const ADMIN_TIER_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN'] as const;

const ADMIN_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  gender: true,
  twoFactorEnabled: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Super-Admin-only management of delegated Sub-Admins — the only place `PlatformUser` rows get
 * created outside the initial seed. Creating one is itself OTP-gated (via SettingsOtpService's
 * 'ADMINS' scope) for the same reason every other platform-config change is: a compromised or
 * unattended Super Admin session shouldn't be able to silently mint new admin accounts.
 */
@Injectable()
export class PlatformAdminsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settingsOtp: SettingsOtpService,
    private readonly notifier: PlatformNotifierService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  async list(q?: string) {
    const rows = await this.platformPrisma.platformUser.findMany({
      where: {
        role: { in: [...ADMIN_TIER_ROLES] },
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { ...ADMIN_SELECT, _count: { select: { schoolsCreated: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: 'asc' },
    });
    // Flatten the Prisma _count wrapper into a plain field — simpler for the frontend to consume.
    return rows.map(({ _count, ...rest }) => ({ ...rest, schoolsCreatedCount: _count.schoolsCreated }));
  }

  /** Full detail view for one admin — everything on ADMIN_SELECT plus activity assembled from
   * relations that already existed but weren't queried anywhere before this (tenantCreationRequests,
   * paymentsRecorded, paymentProofsReviewed, settingsChangeRequests). "Last login" proxies off the
   * most recent PlatformRefreshToken issuance for this user — there's no dedicated lastLoginAt field,
   * and a refresh-token issuance is the closest existing signal without adding new tracking. */
  async findOne(id: string) {
    const admin = await this.platformPrisma.platformUser.findUnique({ where: { id }, select: ADMIN_SELECT });
    if (!admin || !(ADMIN_TIER_ROLES as readonly string[]).includes(admin.role)) {
      throw new NotFoundException('Admin not found');
    }

    const [schoolsCreated, paymentsRecorded, proofsReviewed, settingsChangeRequests, lastRefreshToken] =
      await Promise.all([
        this.platformPrisma.tenant.findMany({
          where: { createdById: id, deletedAt: null },
          select: { id: true, name: true, slug: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.platformPrisma.platformPayment.count({ where: { recordedByUserId: id } }),
        this.platformPrisma.platformPaymentProof.count({ where: { reviewedByUserId: id } }),
        this.platformPrisma.platformSettingsChangeRequest.count({ where: { requestedById: id } }),
        this.platformPrisma.platformRefreshToken.findFirst({
          where: { platformUserId: id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

    return {
      ...admin,
      schoolsCreated,
      activityCounts: {
        paymentsRecorded,
        proofsReviewed,
        settingsChangeRequests,
      },
      lastLoginApprox: lastRefreshToken?.createdAt ?? null,
    };
  }

  async requestCreate(dto: InviteAdminDto, requestedById: string) {
    await this.userDirectory.assertEmailNotInUse(dto.email);
    return this.settingsOtp.request(requestedById, 'ADMINS', dto);
  }

  async confirmCreate(requestId: string, code: string) {
    const { scope, requestedById, changes } = await this.settingsOtp.verifyAndConsume(requestId, code);
    if (scope !== 'ADMINS') throw new BadRequestException('This code is not for an admin-invite request');

    const dto = changes as unknown as InviteAdminDto;
    const inviter = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedById } });
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const admin = await this.platformPrisma.platformUser.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        defaultRole: dto.role,
        mustChangePassword: true,
        gender: dto.gender,
      },
      select: ADMIN_SELECT,
    });

    // Deliberately describes what the recipient can do, never the formal role/tier name — see
    // docs/RBAC.md and the user's explicit ask that outbound messages never say "Super Admin" /
    // "Sub-Admin" / "Assistant Super Admin" to identify anyone. `invitedByName` falls back to the
    // company name, not a rank, if the inviter's own account can't be resolved for some reason.
    const capabilities =
      dto.role === 'ASSISTANT_SUPER_ADMIN'
        ? 'You can create schools, view revenue, and record finance entries.'
        : 'You can create schools and view revenue.';
    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    await this.notifier.notify('SUB_ADMIN_WELCOME', {
      to: { email: dto.email, phone: dto.phone },
      vars: {
        fullName: dto.fullName,
        loginUrl,
        email: dto.email,
        tempPassword,
        invitedByName: inviter?.fullName ?? 'Hamzone Technologies',
        capabilities,
      },
    });

    return admin;
  }

  async deactivate(id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException('You cannot deactivate your own account');
    const target = await this.platformPrisma.platformUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Admin not found');
    if (target.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = await this.platformPrisma.platformUser.count({
        where: { role: 'SUPER_ADMIN', deletedAt: null },
      });
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException('Cannot deactivate the last remaining Super Admin');
      }
    }
    return this.platformPrisma.platformUser.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: ADMIN_SELECT,
    });
  }

  async reactivate(id: string) {
    const target = await this.platformPrisma.platformUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Admin not found');
    return this.platformPrisma.platformUser.update({
      where: { id },
      data: { deletedAt: null },
      select: ADMIN_SELECT,
    });
  }

  /** Unrestricted-by-role search across every PlatformUser — deliberately separate from list()
   * (which stays admin-tier-only for the "Admins" screen) since the role ladder needs to reach
   * trainers/gig-workers/software engineers/staff too, not just the three admin tiers. */
  searchAnyUser(q?: string) {
    return this.platformPrisma.platformUser.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, fullName: true, email: true, role: true, defaultRole: true, deletedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** The role ladder — "the super admin can upgrade someone with more and more and can also
   * downgrade." Works on any PlatformUser (not just admin-tier), protects the last remaining
   * SUPER_ADMIN from ever being demoted away, and never touches `defaultRole` (that's the anchor
   * resetToDefaultRole() returns to, set once at creation and otherwise immutable). Changing a
   * role only takes effect on the affected user's next login/refresh, same JWT-embedding tradeoff
   * as everywhere else `role` is used. */
  async changeRole(id: string, newRole: string) {
    const target = await this.platformPrisma.platformUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const activeSuperAdmins = await this.platformPrisma.platformUser.count({
        where: { role: 'SUPER_ADMIN', deletedAt: null },
      });
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException('Cannot change the role of the last remaining Super Admin');
      }
    }
    return this.platformPrisma.platformUser.update({
      where: { id },
      data: { role: newRole as never },
      select: { id: true, fullName: true, email: true, role: true, defaultRole: true },
    });
  }

  async resetToDefaultRole(id: string) {
    const target = await this.platformPrisma.platformUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!target.defaultRole) {
      throw new BadRequestException('This account has no recorded default role to reset to');
    }
    return this.changeRole(id, target.defaultRole);
  }

  async getModuleGrants(userId: string) {
    const target = await this.platformPrisma.platformUser.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('Admin not found');
    const grants = await this.platformPrisma.platformAdminModuleGrant.findMany({ where: { userId } });
    return { modules: grants.map((g) => g.module) };
  }

  /** Replace-all, same convention as every other "list of settings rows" this codebase manages
   * (pricing tiers, etc.) — simpler than per-row add/remove for a small fixed checklist. Takes
   * effect on the admin's next login/refresh, same JWT-embedding tradeoff as `role` itself. */
  async setModuleGrants(userId: string, modules: string[]) {
    const target = await this.platformPrisma.platformUser.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('Admin not found');
    const unique = [...new Set(modules)];
    await this.platformPrisma.$transaction([
      this.platformPrisma.platformAdminModuleGrant.deleteMany({ where: { userId } }),
      this.platformPrisma.platformAdminModuleGrant.createMany({
        data: unique.map((module) => ({ userId, module })),
      }),
    ]);
    return { modules: unique };
  }
}

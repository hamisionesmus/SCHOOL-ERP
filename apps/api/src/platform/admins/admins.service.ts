import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { generateTempPassword } from '../../common/password.util';
import { InviteAdminDto } from './dto/invite-admin.dto';

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
  ) {}

  async list(q?: string) {
    return this.platformPrisma.platformUser.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: ADMIN_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Full detail view for one admin — everything on ADMIN_SELECT plus activity assembled from
   * relations that already existed but weren't queried anywhere before this (tenantCreationRequests,
   * paymentsRecorded, paymentProofsReviewed, settingsChangeRequests). "Last login" proxies off the
   * most recent PlatformRefreshToken issuance for this user — there's no dedicated lastLoginAt field,
   * and a refresh-token issuance is the closest existing signal without adding new tracking. */
  async findOne(id: string) {
    const admin = await this.platformPrisma.platformUser.findUnique({ where: { id }, select: ADMIN_SELECT });
    if (!admin) throw new NotFoundException('Admin not found');

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
    const existing = await this.platformPrisma.platformUser.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('An admin with this email already exists');
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
}

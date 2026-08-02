import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { generateTempPassword } from '../../common/password.util';
import { InviteAdminDto } from './dto/invite-admin.dto';

const ADMIN_SELECT = { id: true, email: true, fullName: true, phone: true, role: true, deletedAt: true, createdAt: true } as const;

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

  async list() {
    return this.platformPrisma.platformUser.findMany({
      select: ADMIN_SELECT,
      orderBy: { createdAt: 'asc' },
    });
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
      data: { email: dto.email, fullName: dto.fullName, phone: dto.phone, passwordHash, role: 'SUB_ADMIN' },
      select: ADMIN_SELECT,
    });

    const loginUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/login`;
    await this.notifier.notify('SUB_ADMIN_WELCOME', {
      to: { email: dto.email, phone: dto.phone },
      vars: {
        fullName: dto.fullName,
        loginUrl,
        email: dto.email,
        tempPassword,
        invitedByName: inviter?.fullName ?? 'the platform Super Admin',
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

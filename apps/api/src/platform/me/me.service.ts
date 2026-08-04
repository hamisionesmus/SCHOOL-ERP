import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';

/** Self-service account management for the calling PlatformUser — never another admin's row (see
 * MeController, always scoped by the JWT's own `sub`). Name/phone/email changes go through
 * SettingsOtpService's 'PROFILE' scope (code sent to the *current* registered contact, so a stolen
 * session token alone can't silently redirect account recovery); password changes are handled here
 * directly since "prove you know the current password" is already the right gate for that, no OTP
 * needed on top. */
@Injectable()
export class MeService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async getProfile(userId: string) {
    const user = await this.platformPrisma.platformUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, phone: true, role: true, avatarUrl: true, contactEmail: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Not OTP-gated like name/phone/email — a profile picture isn't a recovery-relevant field, so
  // the threat model that justifies SettingsOtpService's 'PROFILE' scope (a hijacked unattended
  // session silently redirecting where account-recovery codes go) doesn't apply here.
  async updateAvatar(userId: string, avatarUrl: string) {
    await this.platformPrisma.platformUser.update({ where: { id: userId }, data: { avatarUrl } });
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.platformPrisma.platformUser.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.platformPrisma.platformUser.update({ where: { id: userId }, data: { passwordHash } });
    return { success: true };
  }
}

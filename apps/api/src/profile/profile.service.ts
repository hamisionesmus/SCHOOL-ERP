import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';

/** Self-service account management for the calling tenant User — never another user's row, always
 * scoped by the JWT's own `sub`. The WhatsApp PIN specifically: current-password-gated the same way
 * MeService.changePassword() gates a platform user's password change — "prove you know the login
 * password" is the right bar for setting up a *new* secret, no separate OTP step needed. */
@Injectable()
export class ProfileService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getProfile(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const row = await db.user.findUnique({ where: { id: user.sub }, select: { fullName: true, email: true, phone: true } });
    if (!row) throw new UnauthorizedException();
    return row;
  }

  /** The WhatsApp bot identifies a sender by matching the phone they're texting from against this
   * field — see WhatsAppService.resolveUserByPhone(). Current-password-gated for the same reason as
   * the PIN below: this is account data that controls what the bot will recognize as "you". */
  async setPhone(user: JwtUserPayload, currentPassword: string, phone: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const row = await db.user.findUnique({ where: { id: user.sub } });
    if (!row) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await db.user.update({ where: { id: user.sub }, data: { phone } });
    return { success: true };
  }

  async getWhatsAppPinStatus(user: JwtUserPayload) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const row = await db.user.findUnique({ where: { id: user.sub }, select: { whatsappPinHash: true } });
    return { set: !!row?.whatsappPinHash };
  }

  async setWhatsAppPin(user: JwtUserPayload, currentPassword: string, pin: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const row = await db.user.findUnique({ where: { id: user.sub } });
    if (!row) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const whatsappPinHash = await bcrypt.hash(pin, 12);
    await db.user.update({
      where: { id: user.sub },
      data: {
        whatsappPinHash,
        whatsappPinVerifiedAt: null,
        whatsappPinChallengeAt: null,
        whatsappPinFailedAttempts: 0,
        whatsappPinLockedUntil: null,
      },
    });
    return { success: true };
  }

  async clearWhatsAppPin(user: JwtUserPayload, currentPassword: string) {
    const db = this.tenantPrisma.forSchema(user.tenantSchema!);
    const row = await db.user.findUnique({ where: { id: user.sub } });
    if (!row) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, row.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await db.user.update({
      where: { id: user.sub },
      data: {
        whatsappPinHash: null,
        whatsappPinVerifiedAt: null,
        whatsappPinChallengeAt: null,
        whatsappPinFailedAttempts: 0,
        whatsappPinLockedUntil: null,
      },
    });
    return { success: true };
  }
}

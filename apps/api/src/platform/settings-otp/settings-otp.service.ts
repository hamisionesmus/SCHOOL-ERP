import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma } from '../../../generated/platform-client';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { UpdatePlatformSettingsDto } from '../platform-settings/dto/update-platform-settings.dto';

const CODE_TTL_MS = 15 * 60 * 1000;

export type SettingsChangeScope = 'SETTINGS' | 'TEMPLATES';

/**
 * Generalizes the two-code tenant-creation gate (see TenantsService.requestCreate/confirmCreate)
 * to platform config changes: propose an edit, a 6-digit code goes to the Super Admin's own
 * email/phone, and only confirming it applies the change — so a compromised or unattended session
 * can't silently alter platform-wide payment config or messaging. One shared request/confirm flow
 * backs both PlatformSettings edits and PlatformMessageTemplate edits; `scope` says which.
 */
@Injectable()
export class SettingsOtpService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async request(requestedById: string, scope: SettingsChangeScope, changes: object) {
    const requester = await this.platformPrisma.platformUser.findUnique({ where: { id: requestedById } });
    if (!requester) throw new UnauthorizedException();

    const code = String(randomInt(100_000, 1_000_000));
    const request = await this.platformPrisma.platformSettingsChangeRequest.create({
      data: {
        requestedById,
        scope,
        changes: changes as Prisma.InputJsonValue,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    await this.notifier.notify('SETTINGS_OTP', {
      to: { email: requester.email, phone: requester.phone },
      vars: { code },
    });

    return { requestId: request.id, expiresAt: request.expiresAt, devCode: code };
  }

  async confirm(requestId: string, code: string) {
    const request = await this.platformPrisma.platformSettingsChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Change request not found');
    if (request.consumedAt) throw new BadRequestException('This request has already been used');
    if (request.expiresAt < new Date()) throw new BadRequestException('This code has expired — start over');
    if (request.code !== code) throw new BadRequestException('Incorrect confirmation code');

    await this.platformPrisma.platformSettingsChangeRequest.update({
      where: { id: requestId },
      data: { consumedAt: new Date() },
    });

    const changes = request.changes as Record<string, unknown>;
    if (request.scope === 'SETTINGS') {
      return this.platformSettings.update(changes as UpdatePlatformSettingsDto);
    }
    if (request.scope === 'TEMPLATES') {
      const { key, ...fields } = changes as { key: string } & Record<string, unknown>;
      return this.platformPrisma.platformMessageTemplate.upsert({
        where: { key },
        update: fields,
        create: { key, ...fields },
      });
    }
    throw new BadRequestException('Unknown change scope');
  }
}

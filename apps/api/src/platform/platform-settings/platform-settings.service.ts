import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

const SETTINGS_ID = 'platform';

/** Singleton row (fixed id) — the platform's own bank/paybill details for receiving activation
 * payments. Distinct from a school's own Tenant.bankName/mpesaPaybill (fee-collection config for
 * that school's parents) — this is where a SCHOOL pays School ERP, not where a parent pays a
 * school. */
@Injectable()
export class PlatformSettingsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async get() {
    return this.platformPrisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  async update(dto: UpdatePlatformSettingsDto) {
    return this.platformPrisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    });
  }

  /** Public-safe subset — only the fields a school needs to see to pay, plus which methods are
   * currently enabled so the activation page can hide any the Super Admin has turned off. */
  async getPublicPaymentDetails() {
    const s = await this.get();
    return {
      bankName: s.bankName,
      bankAccountName: s.bankAccountName,
      bankAccountNumber: s.bankAccountNumber,
      paybillNumber: s.paybillNumber,
      paybillAccountName: s.paybillAccountName,
      stkEnabled: s.stkEnabled,
      bankTransferEnabled: s.bankTransferEnabled,
      paybillEnabled: s.paybillEnabled,
    };
  }
}

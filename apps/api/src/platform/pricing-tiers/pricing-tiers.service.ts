import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { UpdatePricingTiersDto } from './dto/update-pricing-tiers.dto';

/**
 * Activation-fee pricing, driven by a school's expected headcount (students + teachers +
 * non-teaching staff summed) instead of a Super-Admin-typed number — see
 * TenantsService.requestCreate(). Managed as a full-list replace (delete-all + recreate) rather
 * than per-row CRUD, mirroring how every other Settings tab treats its section as one form; OTP-gated
 * via SettingsOtpService's 'PRICING_TIERS' scope since it's platform-wide config that controls what
 * schools get charged, same trust boundary as Payment/API Config.
 */
@Injectable()
export class PricingTiersService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settingsOtp: SettingsOtpService,
  ) {}

  list() {
    return this.platformPrisma.pricingTier.findMany({ orderBy: { minHeadcount: 'asc' } });
  }

  requestUpdate(dto: UpdatePricingTiersDto, requestedById: string) {
    return this.settingsOtp.request(requestedById, 'PRICING_TIERS', dto as unknown as Record<string, unknown>);
  }

  async confirmUpdate(requestId: string, code: string) {
    const { scope, changes } = await this.settingsOtp.verifyAndConsume(requestId, code);
    if (scope !== 'PRICING_TIERS') throw new BadRequestException('This code is not for a pricing-tiers request');

    const { tiers } = changes as unknown as UpdatePricingTiersDto;
    await this.platformPrisma.$transaction([
      this.platformPrisma.pricingTier.deleteMany({}),
      this.platformPrisma.pricingTier.createMany({ data: tiers }),
    ]);
    return this.list();
  }

  /** Authoritative fee lookup — always called server-side with a headcount the client cannot
   * override (see TenantsService.requestCreate()). Throws when no configured tier covers the given
   * headcount, including when no tiers exist yet at all, so a real-account request never silently
   * proceeds with an undefined/zero charge. */
  async computeFee(totalHeadcount: number): Promise<number> {
    const tiers = await this.list();
    const match = tiers.find(
      (t) => totalHeadcount >= t.minHeadcount && (t.maxHeadcount === null || totalHeadcount <= t.maxHeadcount),
    );
    if (!match) {
      throw new BadRequestException(
        `No pricing tier covers ${totalHeadcount} people — ask the Super Admin to configure pricing tiers in Settings first.`,
      );
    }
    return Number(match.priceKes);
  }
}

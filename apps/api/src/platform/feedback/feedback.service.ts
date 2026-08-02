import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

interface FeedbackTokenPayload {
  purpose: 'feedback';
  tenantId: string;
}

/** Backs the short survey linked in a demo's expiry reminder (see RemindersService). Same
 * unauthenticated, signed-token pattern as ActivationService — the token carries all the identity
 * needed, no login required (there may not even be a usable login yet if the demo has expired). */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signFeedbackToken(tenantId: string): Promise<string> {
    const payload: FeedbackTokenPayload = { purpose: 'feedback', tenantId };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '60d',
    });
  }

  private async verifyToken(token: string): Promise<FeedbackTokenPayload> {
    let decoded: FeedbackTokenPayload;
    try {
      decoded = await this.jwt.verifyAsync<FeedbackTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new BadRequestException('This feedback link is invalid or has expired.');
    }
    if (decoded.purpose !== 'feedback') throw new BadRequestException('This feedback link is invalid.');
    return decoded;
  }

  async getSchoolName(token: string) {
    const { tenantId } = await this.verifyToken(token);
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    return { schoolName: tenant.name };
  }

  async submit(token: string, dto: SubmitFeedbackDto) {
    const { tenantId } = await this.verifyToken(token);
    return this.platformPrisma.tenantFeedback.create({
      data: {
        tenantId,
        rating: dto.rating,
        improvements: dto.improvements,
        interestedInRealAccount: dto.interestedInRealAccount,
      },
    });
  }
}

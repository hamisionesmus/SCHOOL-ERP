import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

type FeedbackContext = 'DEMO_EXPIRY' | 'TICKET_RESOLUTION';

interface FeedbackTokenPayload {
  purpose: 'feedback';
  tenantId: string;
  context: FeedbackContext;
  ticketEscalationId?: string;
  ticketSubject?: string;
}

/** Backs both the short survey linked in a demo's expiry reminder (see RemindersService) and the
 * post-resolution survey linked from a resolved support ticket (see TicketsService/
 * PlatformTicketsService's resolve() methods). Same unauthenticated, signed-token pattern as
 * ActivationService — the token carries all the identity needed, no login required. */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly notifier: PlatformNotifierService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signFeedbackToken(
    tenantId: string,
    context: FeedbackContext = 'DEMO_EXPIRY',
    ticket?: { escalationId?: string; subject: string },
  ): Promise<string> {
    const payload: FeedbackTokenPayload = {
      purpose: 'feedback',
      tenantId,
      context,
      ticketEscalationId: ticket?.escalationId,
      ticketSubject: ticket?.subject,
    };
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
    const { tenantId, context, ticketSubject } = await this.verifyToken(token);
    const tenant = await this.platformPrisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!tenant) throw new NotFoundException('School not found');
    return { schoolName: tenant.name, context, ticketSubject };
  }

  async submit(token: string, dto: SubmitFeedbackDto) {
    const { tenantId, context, ticketEscalationId, ticketSubject } = await this.verifyToken(token);
    const feedback = await this.platformPrisma.tenantFeedback.create({
      data: {
        tenantId,
        rating: dto.rating,
        improvements: dto.improvements,
        interestedInRealAccount: dto.interestedInRealAccount,
        context,
        ticketEscalationId,
      },
    });

    // The genuinely new information here is the client's rating/comment, not the fact the ticket
    // was resolved (the Super Admin already sees that in the tickets list) — so this is the moment
    // Super Admins get alerted, not resolution time.
    if (context === 'TICKET_RESOLUTION') {
      const tenant = await this.platformPrisma.tenant.findUnique({ where: { id: tenantId } });
      const superAdmins = await this.platformPrisma.platformUser.findMany({
        where: { role: 'SUPER_ADMIN', deletedAt: null },
      });
      const dashboardUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/dashboard/feedback`;
      for (const admin of superAdmins) {
        await this.notifier.notify('TICKET_FEEDBACK_RECEIVED', {
          to: { email: admin.email, phone: admin.phone },
          vars: {
            schoolName: tenant?.name ?? 'A school',
            subject: ticketSubject ?? 'a support ticket',
            rating: dto.rating ?? 'no rating given',
            dashboardUrl,
          },
        });
      }
    }

    return feedback;
  }
}

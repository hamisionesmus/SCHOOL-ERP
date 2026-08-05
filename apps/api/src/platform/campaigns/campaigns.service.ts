import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { SMS_PROVIDER, SmsProvider } from '../../communications/providers/sms-provider.interface';
import { buildLogoAttachment, wrapWithLogo } from '../messaging/render-email-html';
import { CampaignTargetsDto, CreateCampaignDto } from './dto/create-campaign.dto';

interface RecipientDraft {
  type: 'SCHOOL' | 'PLATFORM_ADMIN' | 'EXTERNAL';
  tenantId?: string;
  platformUserId?: string;
  name: string;
  email?: string;
  phone?: string;
}

/**
 * One-off broadcast emails/SMS to any mix of schools, platform admins, and people outside the
 * system — holiday greetings, maintenance notices, targeted follow-ups (e.g. schools with unpaid
 * invoices). Deliberately bypasses PlatformNotifierService's keyed-template system: campaign
 * content is authored fresh per send, not a fixed message with {{variables}}, so it talks to
 * EMAIL_PROVIDER/SMS_PROVIDER directly (same pattern as ActivationService/MailboxesService).
 * Recipients are resolved once at creation time into CampaignRecipient rows — a stable, durable
 * send list and delivery record, not re-computed live at dispatch time.
 */
@Injectable()
export class CampaignsService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settings: PlatformSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  private async resolveRecipients(targets: CampaignTargetsDto): Promise<RecipientDraft[]> {
    const map = new Map<string, RecipientDraft>();

    const addTenants = (tenants: { id: string; name: string; contactEmail: string | null; contactPhone: string | null }[]) => {
      for (const t of tenants) {
        map.set(`SCHOOL:${t.id}`, {
          type: 'SCHOOL',
          tenantId: t.id,
          name: t.name,
          email: t.contactEmail ?? undefined,
          phone: t.contactPhone ?? undefined,
        });
      }
    };
    const addAdmins = (admins: { id: string; fullName: string; email: string; phone: string | null }[]) => {
      for (const u of admins) {
        map.set(`ADMIN:${u.id}`, {
          type: 'PLATFORM_ADMIN',
          platformUserId: u.id,
          name: u.fullName,
          email: u.email,
          phone: u.phone ?? undefined,
        });
      }
    };

    if (targets.allSchools) {
      addTenants(await this.platformPrisma.tenant.findMany({ where: { deletedAt: null } }));
    }
    if (targets.schoolsWithDebt) {
      addTenants(
        await this.platformPrisma.tenant.findMany({
          where: { deletedAt: null, invoices: { some: { status: { in: ['PENDING', 'OVERDUE'] } } } },
        }),
      );
    }
    if (targets.tenantIds?.length) {
      addTenants(await this.platformPrisma.tenant.findMany({ where: { id: { in: targets.tenantIds }, deletedAt: null } }));
    }
    if (targets.allPlatformAdmins) {
      addAdmins(await this.platformPrisma.platformUser.findMany({ where: { deletedAt: null } }));
    }
    if (targets.platformUserIds?.length) {
      addAdmins(await this.platformPrisma.platformUser.findMany({ where: { id: { in: targets.platformUserIds }, deletedAt: null } }));
    }
    for (const ext of targets.external ?? []) {
      if (!ext.email && !ext.phone) continue;
      map.set(`EXTERNAL:${ext.email ?? ''}:${ext.phone ?? ''}`, {
        type: 'EXTERNAL',
        name: ext.name,
        email: ext.email,
        phone: ext.phone,
      });
    }

    return Array.from(map.values());
  }

  /** Live count + a short sample, without persisting anything — lets the compose form show "This
   * will reach 14 people" before the Super Admin commits to sending. */
  async previewRecipients(targets: CampaignTargetsDto) {
    const recipients = await this.resolveRecipients(targets);
    return {
      count: recipients.length,
      sample: recipients.slice(0, 20).map((r) => ({ name: r.name, email: r.email, phone: r.phone, type: r.type })),
    };
  }

  async list(page = 1, pageSize = 20) {
    const [data, total] = await Promise.all([
      this.platformPrisma.campaign.findMany({
        include: { createdBy: { select: { fullName: true } }, _count: { select: { recipients: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.platformPrisma.campaign.count(),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async findOne(id: string) {
    const campaign = await this.platformPrisma.campaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { fullName: true } },
        recipients: { orderBy: { name: 'asc' } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(dto: CreateCampaignDto, userId: string) {
    if (dto.channel !== 'SMS' && !dto.emailBody?.trim()) {
      throw new BadRequestException('Email body is required for this channel');
    }
    if (dto.channel !== 'EMAIL' && !dto.smsBody?.trim()) {
      throw new BadRequestException('SMS body is required for this channel');
    }

    const recipients = await this.resolveRecipients(dto.targets);
    if (recipients.length === 0) {
      throw new BadRequestException('No recipients matched your selection — pick at least one school, admin, or contact');
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    // A "scheduled" time less than a minute out is treated as "now" — avoids a campaign getting
    // stuck as SCHEDULED for a few seconds waiting on the next cron tick for no real benefit.
    const isFuture = !!scheduledAt && scheduledAt.getTime() > Date.now() + 60_000;

    const campaign = await this.platformPrisma.campaign.create({
      data: {
        subject: dto.subject,
        emailBody: dto.emailBody,
        smsBody: dto.smsBody,
        channel: dto.channel,
        status: isFuture ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: isFuture ? scheduledAt : null,
        createdByUserId: userId,
        recipients: {
          create: recipients.map((r) => ({
            type: r.type,
            tenantId: r.tenantId,
            platformUserId: r.platformUserId,
            name: r.name,
            email: r.email,
            phone: r.phone,
          })),
        },
      },
    });

    if (!isFuture) {
      await this.dispatch(campaign.id);
    }
    return this.findOne(campaign.id);
  }

  /** Sends every PENDING recipient row's email/SMS, updating each one's delivery status
   * individually so one recipient's failure (bad address, provider timeout) never blocks the rest
   * of the batch. Idempotent — a campaign already SENDING/SENT/CANCELLED is left alone, so a
   * cron tick racing a manual dispatch (or firing twice) can't double-send. */
  async dispatch(campaignId: string) {
    const campaign = await this.platformPrisma.campaign.findUnique({
      where: { id: campaignId },
      include: { recipients: true },
    });
    if (!campaign || (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED')) return;

    await this.platformPrisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });

    const settings = await this.settings.get();
    const wantsEmail = campaign.channel !== 'SMS' && !!campaign.emailBody;
    const wantsSms = campaign.channel !== 'EMAIL' && !!campaign.smsBody;
    const logoAttachment = wantsEmail ? await buildLogoAttachment(settings.loginLogoUrl) : null;
    const html = wantsEmail ? wrapWithLogo(campaign.emailBody!, !!logoAttachment) : undefined;

    for (const r of campaign.recipients) {
      if (wantsEmail) {
        if (r.email && settings.emailEnabled) {
          try {
            await this.emailProvider.send(r.email, campaign.subject, campaign.emailBody!, logoAttachment ? [logoAttachment] : undefined, html);
            await this.platformPrisma.campaignRecipient.update({ where: { id: r.id }, data: { emailStatus: 'SENT' } });
          } catch (err) {
            await this.platformPrisma.campaignRecipient.update({
              where: { id: r.id },
              data: { emailStatus: 'FAILED', emailError: err instanceof Error ? err.message : 'Send failed' },
            });
          }
        } else {
          await this.platformPrisma.campaignRecipient.update({ where: { id: r.id }, data: { emailStatus: 'SKIPPED' } });
        }
      }
      if (wantsSms) {
        if (r.phone && settings.smsEnabled) {
          try {
            await this.smsProvider.send(r.phone, campaign.smsBody!);
            await this.platformPrisma.campaignRecipient.update({ where: { id: r.id }, data: { smsStatus: 'SENT' } });
          } catch (err) {
            await this.platformPrisma.campaignRecipient.update({
              where: { id: r.id },
              data: { smsStatus: 'FAILED', smsError: err instanceof Error ? err.message : 'Send failed' },
            });
          }
        } else {
          await this.platformPrisma.campaignRecipient.update({ where: { id: r.id }, data: { smsStatus: 'SKIPPED' } });
        }
      }
    }

    await this.platformPrisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENT', sentAt: new Date() } });
  }

  /** Picks up campaigns whose scheduledAt has arrived — the counterpart to create()'s immediate
   * path for anything the Super Admin chose to schedule ahead (a holiday greeting timed for the
   * morning of, a maintenance notice sent the day before). */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchScheduled() {
    const due = await this.platformPrisma.campaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    });
    for (const c of due) {
      await this.dispatch(c.id);
    }
  }

  async cancel(id: string) {
    const campaign = await this.platformPrisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new BadRequestException('Only a draft or scheduled campaign can be cancelled');
    }
    return this.platformPrisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}

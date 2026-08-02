import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PlatformNotifierService } from '../messaging/platform-notifier.service';
import { FeedbackService } from '../feedback/feedback.service';

/**
 * The one genuinely proactive background job in this codebase — everything else that "checks a
 * deadline" (demo expiry, SUSPENDED status) does so reactively, live at login (see
 * AuthService.login), since there was no scheduler until now. This warns a school *before* they
 * lose access, which a login-time check structurally can't do for someone who isn't logging in.
 * Runs once daily; each reminder is deduped via a *ReminderSentAt timestamp on Tenant so re-running
 * (or a slow day) never double-sends — see checkDeadlines() for the dedupe logic.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger('Reminders');

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly notifier: PlatformNotifierService,
    private readonly feedback: FeedbackService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkDeadlines() {
    const settings = await this.platformSettings.get();
    const now = new Date();

    const demoDeadline = new Date(now.getTime() + settings.demoReminderDaysBefore * 86_400_000);
    const dueDemos = await this.platformPrisma.tenant.findMany({
      where: {
        isDemo: true,
        status: 'ACTIVE',
        demoExpiresAt: { lte: demoDeadline, gt: now },
        demoReminderSentAt: null,
      },
    });
    for (const tenant of dueDemos) {
      const daysLeft = Math.max(1, Math.ceil((tenant.demoExpiresAt!.getTime() - now.getTime()) / 86_400_000));
      const surveyToken = await this.feedback.signFeedbackToken(tenant.id);
      const surveyUrl = `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/feedback/${surveyToken}`;
      await this.notifier.notify('DEMO_REMINDER', {
        to: { email: tenant.contactEmail, phone: tenant.contactPhone },
        vars: {
          schoolName: tenant.name,
          daysLeft,
          expiryDate: tenant.demoExpiresAt!.toLocaleString('en-KE'),
          surveyUrl,
        },
      });
      await this.platformPrisma.tenant.update({ where: { id: tenant.id }, data: { demoReminderSentAt: now } });
      this.logger.log(`Sent DEMO_REMINDER to ${tenant.slug} (${daysLeft}d left)`);
    }

    const renewalDeadline = new Date(now.getTime() + settings.renewalReminderDaysBefore * 86_400_000);
    const dueRenewals = await this.platformPrisma.tenant.findMany({
      where: {
        isDemo: false,
        status: 'ACTIVE',
        currentPeriodEnd: { lte: renewalDeadline, gt: now },
        renewalReminderSentAt: null,
      },
    });
    for (const tenant of dueRenewals) {
      const daysLeft = Math.max(1, Math.ceil((tenant.currentPeriodEnd!.getTime() - now.getTime()) / 86_400_000));
      await this.notifier.notify('RENEWAL_REMINDER', {
        to: { email: tenant.contactEmail, phone: tenant.contactPhone },
        vars: {
          schoolName: tenant.name,
          daysLeft,
          renewalDate: tenant.currentPeriodEnd!.toLocaleString('en-KE'),
        },
      });
      await this.platformPrisma.tenant.update({ where: { id: tenant.id }, data: { renewalReminderSentAt: now } });
      this.logger.log(`Sent RENEWAL_REMINDER to ${tenant.slug} (${daysLeft}d left)`);
    }

    return { demoReminders: dueDemos.length, renewalReminders: dueRenewals.length };
  }
}

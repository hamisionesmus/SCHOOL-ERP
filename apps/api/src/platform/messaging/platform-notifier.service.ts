import { Inject, Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider.interface';
import { SMS_PROVIDER, SmsProvider } from '../../communications/providers/sms-provider.interface';
import { DEFAULT_TEMPLATES, MessageTemplateKey } from './default-templates';
import { wrapWithLogo, buildLogoAttachment } from './render-email-html';

interface RenderedTemplate {
  subject?: string;
  emailBody?: string;
  smsBody?: string;
}

function substitute(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/**
 * The single choke point every outbound platform message goes through — school-creation OTPs,
 * welcome/activation messages, payment confirmations, deadline reminders. Looks up a customized
 * PlatformMessageTemplate row (falling back to the built-in default when none exists — see
 * default-templates.ts), substitutes {{variables}}, and checks PlatformSettings.smsEnabled/
 * emailEnabled before actually calling the provider. Customizing a message or disabling a channel
 * in Settings takes effect everywhere at once because every send-site calls this instead of
 * inlining its own strings.
 */
@Injectable()
export class PlatformNotifierService {
  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settings: PlatformSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  private async render(key: MessageTemplateKey, vars: Record<string, string | number>): Promise<RenderedTemplate> {
    const custom = await this.platformPrisma.platformMessageTemplate.findUnique({ where: { key } });
    const fallback = DEFAULT_TEMPLATES[key];
    const subject = custom?.subject ?? fallback.subject;
    const emailBody = custom?.emailBody ?? fallback.emailBody;
    const smsBody = custom?.smsBody ?? fallback.smsBody;
    return {
      subject: subject ? substitute(subject, vars) : undefined,
      emailBody: emailBody ? substitute(emailBody, vars) : undefined,
      smsBody: smsBody ? substitute(smsBody, vars) : undefined,
    };
  }

  async notify(
    key: MessageTemplateKey,
    options: { to: { email?: string | null; phone?: string | null }; vars: Record<string, string | number> },
  ): Promise<void> {
    const settings = await this.settings.get();
    // Every template's {{systemName}} resolves from the Super-Admin-configured branding name here,
    // so no individual call site needs to pass it — matches how logo/enabled-channel checks below
    // are already sourced from the same settings row rather than hardcoded per template.
    const vars = { ...options.vars, systemName: settings.systemName || 'School ERP' };
    const rendered = await this.render(key, vars);

    if (settings.emailEnabled && options.to.email && rendered.emailBody) {
      const logoAttachment = await buildLogoAttachment(settings.loginLogoUrl);
      const html = wrapWithLogo(rendered.emailBody, !!logoAttachment);
      await this.emailProvider.send(
        options.to.email,
        rendered.subject ?? '',
        rendered.emailBody,
        logoAttachment ? [logoAttachment] : undefined,
        html,
      );
    }
    if (settings.smsEnabled && options.to.phone && rendered.smsBody) {
      await this.smsProvider.send(options.to.phone, rendered.smsBody);
    }
  }
}

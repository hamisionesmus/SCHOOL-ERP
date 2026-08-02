import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { DEFAULT_TEMPLATES, MessageTemplateKey } from '../messaging/default-templates';

export interface EffectiveTemplate {
  key: MessageTemplateKey;
  subject?: string;
  emailBody?: string;
  smsBody?: string;
  variables: string[];
  isCustomized: boolean;
}

@Injectable()
export class MessageTemplatesService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  /** One entry per known template key, showing the *effective* content (customized row if one
   * exists and has that field set, otherwise the built-in default) plus whether it's customized —
   * lets the Settings UI show "default" vs "customized" and offer a reset. */
  async listEffective(): Promise<EffectiveTemplate[]> {
    const customRows = await this.platformPrisma.platformMessageTemplate.findMany();
    const customByKey = new Map(customRows.map((r) => [r.key, r]));

    return (Object.keys(DEFAULT_TEMPLATES) as MessageTemplateKey[]).map((key) => {
      const fallback = DEFAULT_TEMPLATES[key];
      const custom = customByKey.get(key);
      return {
        key,
        subject: custom?.subject ?? fallback.subject,
        emailBody: custom?.emailBody ?? fallback.emailBody,
        smsBody: custom?.smsBody ?? fallback.smsBody,
        variables: fallback.variables,
        isCustomized: !!custom && (custom.subject != null || custom.emailBody != null || custom.smsBody != null),
      };
    });
  }
}

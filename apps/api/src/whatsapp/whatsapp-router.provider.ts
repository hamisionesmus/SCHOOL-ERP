import { Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../platform/platform-settings/platform-settings.service';
import { SendWhatsAppResult, WhatsAppProvider } from './whatsapp-provider.interface';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';
import { WhatsAppBaileysService } from './baileys/whatsapp-baileys.service';

/**
 * The WHATSAPP_PROVIDER token binds here rather than directly to either concrete implementation —
 * PlatformSettings.whatsappProvider ('BAILEYS' | 'CLOUD_API') is read per call, same "resolved at
 * call time, not at boot" pattern already used for the DB-backed credential resolution in
 * WhatsAppCloudProvider/ResendEmailProvider/AdvantaSmsProvider, so switching providers in Settings
 * takes effect immediately with no redeploy.
 */
@Injectable()
export class WhatsAppRouterProvider implements WhatsAppProvider {
  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly baileys: WhatsAppBaileysService,
    private readonly cloud: WhatsAppCloudProvider,
  ) {}

  async send(to: string, body: string): Promise<SendWhatsAppResult> {
    const settings = await this.platformSettings.get();
    const provider = settings.whatsappProvider === 'CLOUD_API' ? this.cloud : this.baileys;
    return provider.send(to, body);
  }
}

import { Controller, Get, Logger, Post, Query, RawBodyRequest, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PlatformSettingsService } from '../platform/platform-settings/platform-settings.service';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { WhatsAppService } from './whatsapp.service';

interface WhatsAppWebhookPayload {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        messages?: { from: string; id: string; type: string; text?: { body: string } }[];
        statuses?: { id: string; status: string }[];
      };
    }[];
  }[];
}

/** Entirely public — Meta's own servers call these, not a logged-in user. No JwtAuthGuard, same shape
 * as ActivationController (the other unauthenticated controller in this app). The GET route is Meta's
 * one-time webhook-registration handshake; POST is where every inbound message/status update actually
 * arrives, continuously, for the lifetime of the integration. */
@ApiTags('public/whatsapp')
@Controller('public/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger('WhatsApp');

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly platformPrisma: PlatformPrismaService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  @Get('webhook')
  async verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const settings = await this.platformSettings.get();
    if (mode === 'subscribe' && settings.whatsappVerifyToken && token === settings.whatsappVerifyToken) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Verification failed');
  }

  @Post('webhook')
  async receive(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    // Always acknowledge quickly — Meta disables a webhook that repeatedly times out or errors, even
    // if the underlying cause is something this endpoint recovers from a moment later.
    res.status(200).send('EVENT_RECEIVED');

    const settings = await this.platformSettings.get();
    if (settings.whatsappAppSecret && req.rawBody) {
      const signatureHeader = req.headers['x-hub-signature-256'];
      if (!this.verifySignature(req.rawBody, typeof signatureHeader === 'string' ? signatureHeader : undefined, settings.whatsappAppSecret)) {
        this.logger.warn('Rejected WhatsApp webhook call with invalid signature');
        return;
      }
    }

    const payload = req.body as WhatsAppWebhookPayload;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          if (message.type !== 'text' || !message.text) continue;
          await this.whatsAppService
            .handleInboundMessage(message.from, message.text.body, message.id)
            .catch((err) => this.logger.error(`Failed to handle inbound WhatsApp message: ${err instanceof Error ? err.message : String(err)}`));
        }
        for (const status of change.value?.statuses ?? []) {
          await this.platformPrisma.platformWhatsAppMessage
            .updateMany({ where: { messageId: status.id }, data: { status: status.status } })
            .catch(() => undefined);
        }
      }
    }
  }

  private verifySignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');
    return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
  }
}

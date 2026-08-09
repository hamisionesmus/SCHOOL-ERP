import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import * as QRCode from 'qrcode';
import { pino } from 'pino';
import {
  Browsers,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  jidDecode,
} from '@whiskeysockets/baileys';
import type { Boom } from '@hapi/boom';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { useDbAuthState } from './whatsapp-auth-state';
import { SendWhatsAppResult, WhatsAppProvider } from '../whatsapp-provider.interface';

export type BaileysStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING' | 'CONNECTED' | 'ERROR';

export interface BaileysStatusSnapshot {
  status: BaileysStatus;
  qrDataUrl: string | null;
  connectedPhone: string | null;
  lastConnectedAt: Date | null;
  lastError: string | null;
}

const SESSION_ID = 'default';
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Owns the one shared, in-process Baileys "linked device" socket connection — a real personal/
 * business WhatsApp number connected the same way WhatsApp Web links a browser, by scanning a QR
 * code. There is exactly one of these per platform (not per tenant), same "one shared business
 * number" design as the Meta Cloud API path (WhatsAppCloudProvider) it sits alongside — a Super
 * Admin picks which one is actually used to send via PlatformSettings.whatsappProvider (see
 * WhatsAppRouterProvider).
 *
 * Unofficial/ToS caveat (stated in code, not just chat): this connects via reverse-engineered
 * WhatsApp Web protocol, not Meta's approved Business API. It's the only way to get instant,
 * approval-free setup, but carries real risk of the linked number being flagged/banned by Meta for
 * automated business use — a tradeoff the user explicitly chose over the slower-but-official Cloud
 * API path already built in whatsapp-cloud.provider.ts.
 */
@Injectable()
export class WhatsAppBaileysService implements WhatsAppProvider, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WhatsAppBaileys');
  private sock: WASocket | null = null;
  private connecting = false;
  private consecutiveFailures = 0;
  private destroyed = false;
  /** Inbound messages are emitted here rather than calling WhatsAppService directly, to avoid a
   * circular DI dependency (WhatsAppService depends on the WHATSAPP_PROVIDER token, which this class
   * can be bound to) — WhatsAppService subscribes to this in its own onModuleInit(). */
  readonly events = new EventEmitter();

  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async onModuleInit() {
    // Auto-reconnect on boot (container restart/redeploy) if a session was already linked — this is
    // the entire reason the auth state is DB-backed instead of filesystem-backed: no QR re-scan
    // needed after every CI/CD deploy.
    const existingCreds = await this.platformPrisma.platformWhatsAppAuthKey.findUnique({ where: { keyId: 'creds' } });
    if (existingCreds) {
      this.connect().catch((err) => this.logger.error(`Auto-reconnect failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.sock?.end(undefined);
  }

  async getStatus(): Promise<BaileysStatusSnapshot> {
    const row = await this.platformPrisma.platformWhatsAppSession.upsert({
      where: { id: SESSION_ID },
      update: {},
      create: { id: SESSION_ID },
    });
    return {
      status: row.status as BaileysStatus,
      qrDataUrl: row.qrDataUrl,
      connectedPhone: row.connectedPhone,
      lastConnectedAt: row.lastConnectedAt,
      lastError: row.lastError,
    };
  }

  private async setStatus(patch: Partial<{
    status: BaileysStatus;
    qrDataUrl: string | null;
    connectedPhone: string | null;
    lastConnectedAt: Date | null;
    lastDisconnectedAt: Date | null;
    lastError: string | null;
  }>) {
    await this.platformPrisma.platformWhatsAppSession.upsert({
      where: { id: SESSION_ID },
      update: patch,
      create: { id: SESSION_ID, ...patch },
    });
  }

  /** Idempotent — safe to call from the "Connect" button even if a connection attempt is already in
   * flight (e.g. a second click while the QR is still loading). */
  async startConnection(): Promise<void> {
    if (this.connecting || this.sock) return;
    this.consecutiveFailures = 0;
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    await this.setStatus({ status: 'CONNECTING', qrDataUrl: null, lastError: null });

    try {
      const { state, saveCreds } = await useDbAuthState(this.platformPrisma);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as unknown as [number, number, number] }));
      const logger = pino({ level: 'silent' });

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        version,
        logger,
        browser: Browsers.appropriate('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });
      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', (update) => {
        void this.handleConnectionUpdate(update).catch((err) =>
          this.logger.error(`connection.update handler failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      });

      sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          void this.handleIncomingMessage(msg).catch((err) =>
            this.logger.error(`inbound message handling failed: ${err instanceof Error ? err.message : String(err)}`),
          );
        }
      });
    } catch (err) {
      this.connecting = false;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to start Baileys connection: ${message}`);
      await this.setStatus({ status: 'ERROR', lastError: message });
    }
  }

  private async handleConnectionUpdate(update: { connection?: string; qr?: string; lastDisconnect?: { error?: Boom | Error } }) {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      await this.setStatus({ status: 'QR_PENDING', qrDataUrl });
      return;
    }

    if (connection === 'open') {
      this.connecting = false;
      this.consecutiveFailures = 0;
      const rawJid = this.sock?.user?.id ?? null;
      const phone = rawJid ? jidDecode(rawJid)?.user ?? null : null;
      await this.setStatus({
        status: 'CONNECTED',
        qrDataUrl: null,
        connectedPhone: phone,
        lastConnectedAt: new Date(),
        lastError: null,
      });
      this.logger.log(`WhatsApp linked device connected${phone ? ` as +${phone}` : ''}`);
      return;
    }

    if (connection === 'close') {
      this.connecting = false;
      this.sock = null;
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        await useDbAuthState(this.platformPrisma).then((s) => s.clearAll());
        await this.setStatus({ status: 'DISCONNECTED', qrDataUrl: null, connectedPhone: null, lastDisconnectedAt: new Date(), lastError: 'Logged out from the phone — scan a new QR code to reconnect.' });
        return;
      }

      await this.setStatus({ status: 'CONNECTING', lastDisconnectedAt: new Date() });

      if (this.destroyed) return;
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
        await this.setStatus({ status: 'ERROR', lastError: 'Repeated reconnect failures — click Connect to try again.' });
        return;
      }
      // Backoff: 2s, 4s, 8s... capped at 30s, so a flaky network doesn't spin-loop the process.
      const delayMs = Math.min(2000 * 2 ** (this.consecutiveFailures - 1), 30000);
      setTimeout(() => {
        if (!this.destroyed) this.connect().catch((err) => this.logger.error(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`));
      }, delayMs);
    }
  }

  private async handleIncomingMessage(msg: import('@whiskeysockets/baileys').WAMessage) {
    if (!msg.message || msg.key.fromMe) return;
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return; // ignore groups/status

    const text = msg.message.conversation ?? msg.message.extendedTextMessage?.text;
    if (!text) return;

    const phone = jidDecode(remoteJid)?.user;
    if (!phone) return;

    const messageId = msg.key.id ?? `${remoteJid}-${msg.messageTimestamp}`;
    this.events.emit('message', { waId: phone, text, messageId });
  }

  /** WhatsAppProvider implementation — used by WhatsAppRouterProvider when whatsappProvider is
   * 'BAILEYS'. Fails clearly (rather than silently degrading to a stub) if not currently connected,
   * since — unlike the Cloud API — there's no separate "not configured yet" state to fall back to. */
  async send(to: string, body: string): Promise<SendWhatsAppResult> {
    if (!this.sock) {
      this.logger.warn(`Cannot send to ${to} — WhatsApp linked device is not connected`);
      return { success: false };
    }
    const digits = to.replace(/[^\d]/g, '');
    const jid = `${digits}@s.whatsapp.net`;
    try {
      const result = await this.sock.sendMessage(jid, { text: body });
      return { success: true, providerMessageId: result?.key.id ?? undefined };
    } catch (err) {
      this.logger.error(`Send failed to ${to}: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false };
    }
  }

  /** Explicit "Disconnect" from Settings — unlinks the device on WhatsApp's side (so it also
   * disappears from the phone's own Linked Devices list, not just locally) and wipes the stored
   * session so the next Connect always starts a genuinely fresh pairing. */
  async logout(): Promise<void> {
    try {
      await this.sock?.logout();
    } catch {
      // best-effort — the socket may already be dead; still clear local state below.
    }
    this.sock = null;
    this.connecting = false;
    await useDbAuthState(this.platformPrisma).then((s) => s.clearAll());
    await this.setStatus({ status: 'DISCONNECTED', qrDataUrl: null, connectedPhone: null, lastDisconnectedAt: new Date(), lastError: null });
  }
}

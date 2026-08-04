import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { SettingsOtpService } from '../settings-otp/settings-otp.service';
import { UpdateMailboxCredentialsDto } from './dto/update-mailbox-credentials.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { MAILBOX_KEYS, MAILBOX_DEFAULTS, MailboxKey, CONTACTABLE_KEYS } from './mailbox-keys';

function maskSecret(value: string | null | undefined): { set: boolean; preview: string | null } {
  if (!value) return { set: false, preview: null };
  return { set: true, preview: value.length > 4 ? `••••${value.slice(-4)}` : '••••' };
}

/** Strips a leading "Re:"/"Fwd:" chain (case-insensitive, repeated) for loose subject-based thread
 * matching when no In-Reply-To/References header lines up with a message we already have. */
function normalizeSubject(subject: string): string {
  return subject.replace(/^\s*(re|fwd?)\s*:\s*/i, '').trim();
}

/**
 * Real, reply-able two-way email for four named identities (info@/partner@/billing@/a personal
 * address, all @hamzonetechnologies.com) — distinct from PlatformNotifierService's one-way,
 * no-reply system notices. Outbound goes via each mailbox's own real SMTP (so replies land in that
 * real mailbox, not a black hole); inbound is picked up by polling that same mailbox over IMAP on a
 * short cron and mirrored into PlatformEmailThread/PlatformEmailMessage so it's visible in-app.
 */
@Injectable()
export class MailboxesService {
  private readonly logger = new Logger('Mailboxes');
  private readonly transporters = new Map<MailboxKey, nodemailer.Transporter>();

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly settingsOtp: SettingsOtpService,
  ) {}

  private async getOrCreate(key: MailboxKey) {
    const defaults = MAILBOX_DEFAULTS[key];
    return this.platformPrisma.platformMailbox.upsert({
      where: { key },
      update: {},
      create: { key, address: defaults.address, displayName: defaults.displayName },
    });
  }

  async list() {
    const rows = await Promise.all(MAILBOX_KEYS.map((key) => this.getOrCreate(key)));
    return rows.map((m) => ({
      ...m,
      password: undefined,
      passwordStatus: maskSecret(m.password),
      configured: !!(m.smtpHost && m.username && m.password),
    }));
  }

  requestUpdateCredentials(dto: UpdateMailboxCredentialsDto, requestedById: string) {
    return this.settingsOtp.request(requestedById, 'MAILBOXES', dto as unknown as Record<string, unknown>);
  }

  async confirmUpdateCredentials(requestId: string, code: string) {
    const { scope, changes } = await this.settingsOtp.verifyAndConsume(requestId, code);
    if (scope !== 'MAILBOXES') throw new BadRequestException('This code is not for a mailbox-credentials request');

    const { key, password, ...rest } = changes as unknown as UpdateMailboxCredentialsDto;
    await this.getOrCreate(key);
    await this.platformPrisma.platformMailbox.update({
      where: { key },
      // Blank/omitted password means "don't change" — never null out a working credential just
      // because the client can't see it to resubmit (same convention as every secret field in
      // PlatformSettingsService).
      data: { ...rest, ...(password ? { password } : {}) },
    });
    this.transporters.delete(key);
    return this.list();
  }

  private getTransporter(mailbox: { key: string; smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean; username: string | null; password: string | null }) {
    const key = mailbox.key as MailboxKey;
    let transporter = this.transporters.get(key);
    if (transporter) return transporter;
    if (!mailbox.smtpHost || !mailbox.username || !mailbox.password) return null;

    transporter = nodemailer.createTransport({
      host: mailbox.smtpHost,
      port: mailbox.smtpPort ?? 587,
      secure: mailbox.smtpSecure,
      auth: { user: mailbox.username, pass: mailbox.password },
    });
    this.transporters.set(key, transporter);
    return transporter;
  }

  /** Sends a new or reply message from the given mailbox's real identity, and mirrors it into the
   * thread/message log so it shows up in-app exactly like an inbound message would. */
  async sendMessage(key: MailboxKey, dto: SendEmailDto & { threadId?: string }, sentByUserId?: string) {
    const mailbox = await this.getOrCreate(key);
    const transporter = this.getTransporter(mailbox);
    if (!transporter) {
      throw new BadRequestException(
        `The ${mailbox.displayName} mailbox isn't configured yet — add its SMTP credentials in Settings first.`,
      );
    }

    let thread = dto.threadId
      ? await this.platformPrisma.platformEmailThread.findUnique({ where: { id: dto.threadId } })
      : null;
    if (dto.threadId && !thread) throw new NotFoundException('Thread not found');

    const lastInbound = thread
      ? await this.platformPrisma.platformEmailMessage.findFirst({
          where: { threadId: thread.id, direction: 'IN' },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    const info = await transporter.sendMail({
      from: `${mailbox.displayName} <${mailbox.address}>`,
      to: dto.to,
      subject: dto.subject,
      text: dto.body,
      ...(lastInbound?.messageId
        ? { inReplyTo: lastInbound.messageId, references: lastInbound.messageId }
        : {}),
    });

    if (!thread) {
      thread = await this.platformPrisma.platformEmailThread.create({
        data: {
          mailboxId: mailbox.id,
          subject: dto.subject,
          participantEmail: dto.to,
          lastMessageAt: new Date(),
        },
      });
    } else {
      await this.platformPrisma.platformEmailThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date() },
      });
    }

    return this.platformPrisma.platformEmailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUT',
        fromAddress: mailbox.address,
        toAddress: dto.to,
        subject: dto.subject,
        bodyText: dto.body,
        messageId: info.messageId || undefined,
        inReplyTo: lastInbound?.messageId ?? undefined,
        sentByUserId,
      },
    });
  }

  /** Polls one mailbox's IMAP inbox for unseen messages, mirrors each into a thread/message row
   * (deduped by Message-ID), and marks them seen so they aren't re-imported next poll. Errors are
   * caught and logged, never thrown — one mailbox's bad/missing credentials or a transient network
   * blip must never block the other three from polling. */
  async pollMailbox(key: MailboxKey): Promise<void> {
    const mailbox = await this.getOrCreate(key);
    if (!mailbox.imapHost || !mailbox.username || !mailbox.password) return;

    const client = new ImapFlow({
      host: mailbox.imapHost,
      port: mailbox.imapPort ?? 993,
      secure: mailbox.imapSecure,
      auth: { user: mailbox.username, pass: mailbox.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
          try {
            await this.importInboundMessage(mailbox, msg.source as Buffer);
          } catch (err) {
            this.logger.error(`Failed to import a message for ${mailbox.address}: ${err instanceof Error ? err.message : String(err)}`);
          }
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
      await this.platformPrisma.platformMailbox.update({ where: { key }, data: { lastPolledAt: new Date() } });
    } catch (err) {
      this.logger.error(`IMAP poll failed for ${mailbox.address}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Shared thread-matching logic behind both the real IMAP-import path (importInboundMessage) and
   * the internal contact-form path (contact()): match by In-Reply-To/References against a message
   * we already have, else by participant+subject, else start a fresh thread. */
  private async findOrCreateThread(
    mailboxId: string,
    participantEmail: string,
    participantName: string | undefined,
    subject: string,
    candidateRefs: string[],
    occurredAt: Date,
  ) {
    let thread = null as Awaited<ReturnType<typeof this.platformPrisma.platformEmailThread.findFirst>>;
    if (candidateRefs.length > 0) {
      const matched = await this.platformPrisma.platformEmailMessage.findFirst({
        where: { messageId: { in: candidateRefs } },
      });
      if (matched) {
        thread = await this.platformPrisma.platformEmailThread.findUnique({ where: { id: matched.threadId } });
      }
    }
    if (!thread) {
      thread = await this.platformPrisma.platformEmailThread.findFirst({
        where: {
          mailboxId,
          participantEmail,
          subject: { equals: normalizeSubject(subject), mode: 'insensitive' },
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    }
    if (!thread) {
      return this.platformPrisma.platformEmailThread.create({
        data: { mailboxId, subject: normalizeSubject(subject), participantEmail, participantName, lastMessageAt: occurredAt },
      });
    }
    await this.platformPrisma.platformEmailThread.update({ where: { id: thread.id }, data: { lastMessageAt: occurredAt } });
    return thread;
  }

  private async importInboundMessage(mailbox: { id: string; key: string }, source: Buffer) {
    const parsed = await simpleParser(source);
    const messageId = parsed.messageId || undefined;
    if (messageId) {
      const existing = await this.platformPrisma.platformEmailMessage.findUnique({ where: { messageId } });
      if (existing) return;
    }

    const fromEntry = Array.isArray(parsed.from?.value) ? parsed.from.value[0] : undefined;
    const fromAddress = fromEntry?.address ?? 'unknown@unknown';
    const fromName = fromEntry?.name || undefined;
    const subject = parsed.subject || '(no subject)';
    const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
    const candidateRefs = [parsed.inReplyTo, ...references].filter((v): v is string => !!v);

    const thread = await this.findOrCreateThread(
      mailbox.id,
      fromAddress,
      fromName,
      subject,
      candidateRefs,
      parsed.date ?? new Date(),
    );

    await this.platformPrisma.platformEmailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'IN',
        fromAddress,
        toAddress: (Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to?.text) ?? '',
        subject,
        bodyText: parsed.text ?? '',
        bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
        messageId,
        inReplyTo: parsed.inReplyTo || undefined,
        read: false,
      },
    });
  }

  /** Internal message injection — no real SMTP send. Used by the restricted Sub-Admin/Assistant
   * Super Admin "contact the platform team" flow: writes the message directly into the target
   * mailbox's thread as if it had arrived by IMAP (direction: IN), sidestepping any From-spoofing
   * concern entirely since no real email leaves this server for this leg. The *reply* — sent by
   * whoever manages that mailbox, via sendMessage()'s real SMTP — is what genuinely reaches the
   * sender's real inbox. */
  async contact(key: MailboxKey, opts: { fromEmail: string; fromName?: string; subject: string; body: string }) {
    const mailbox = await this.getOrCreate(key);
    const thread = await this.findOrCreateThread(mailbox.id, opts.fromEmail, opts.fromName, opts.subject, [], new Date());
    return this.platformPrisma.platformEmailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'IN',
        fromAddress: opts.fromEmail,
        toAddress: mailbox.address,
        subject: opts.subject,
        bodyText: opts.body,
        read: false,
      },
    });
  }

  /** Resolves which address a Sub-Admin/Assistant Super Admin's restricted contact messages come
   * from — their self-registered contactEmail if set, else their own login email. */
  async resolveContactEmail(userId: string): Promise<string> {
    const user = await this.platformPrisma.platformUser.findUniqueOrThrow({ where: { id: userId } });
    return user.contactEmail ?? user.email;
  }

  /** A Sub-Admin/Assistant Super Admin's own conversations with Info/Partner/Billing — never the
   * full inbox, only threads where they are the participant (see canRoleContactMailbox). */
  async myThreads(contactEmail: string) {
    return this.platformPrisma.platformEmailThread.findMany({
      where: { participantEmail: contactEmail, mailbox: { key: { in: CONTACTABLE_KEYS as string[] } } },
      include: {
        mailbox: { select: { key: true, address: true, displayName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { direction: 'IN', read: false } } } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  @Cron('*/2 * * * *')
  async pollAllMailboxes() {
    for (const key of MAILBOX_KEYS) {
      await this.pollMailbox(key);
    }
  }

  async listThreads(keys: readonly MailboxKey[]) {
    return this.platformPrisma.platformEmailThread.findMany({
      where: { mailbox: { key: { in: keys as string[] } } },
      include: {
        mailbox: { select: { key: true, address: true, displayName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: { where: { direction: 'IN', read: false } } } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getThread(threadId: string) {
    const thread = await this.platformPrisma.platformEmailThread.findUnique({
      where: { id: threadId },
      include: {
        mailbox: { select: { key: true, address: true, displayName: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { sentBy: { select: { fullName: true } } } },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  async markThreadRead(threadId: string) {
    await this.platformPrisma.platformEmailMessage.updateMany({
      where: { threadId, direction: 'IN', read: false },
      data: { read: true },
    });
    return { ok: true };
  }

  /** Unread inbound count across whichever mailboxes the caller can see — feeds the platform
   * notification bell (see PlatformNotificationsService.list()). */
  async unreadCount(keys: readonly MailboxKey[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.platformPrisma.platformEmailMessage.count({
      where: { direction: 'IN', read: false, thread: { mailbox: { key: { in: keys as string[] } } } },
    });
  }
}

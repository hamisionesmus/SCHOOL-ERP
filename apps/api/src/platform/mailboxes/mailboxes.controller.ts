import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { MailboxesService } from './mailboxes.service';
import { UpdateMailboxCredentialsDto } from './dto/update-mailbox-credentials.dto';
import { SendEmailDto, ReplyEmailDto } from './dto/send-email.dto';
import { ConfirmSettingsChangeDto } from '../settings-otp/dto/confirm-settings-change.dto';
import { MAILBOX_KEYS, MailboxKey, accessibleMailboxKeys, canRoleAccessMailbox } from './mailbox-keys';

function assertKey(key: string): asserts key is MailboxKey {
  if (!(MAILBOX_KEYS as readonly string[]).includes(key)) {
    throw new ForbiddenException('Unknown mailbox');
  }
}

/**
 * Real, reply-able correspondence from four named identities — distinct from every other platform
 * email, which is one-way system notices via PlatformNotifierService. Info/Partner/Personal are
 * Super-Admin-only; Billing is also open to Assistant Super Admin (per the explicit split this was
 * built for) — enforced per-handler via canRoleAccessMailbox() since the restriction depends on
 * which mailbox `:key` is being touched, not just the caller's role, which a static
 * @RequirePlatformRole() decorator alone can't express. Credential management (SMTP/IMAP
 * host/port/username/password) stays Super-Admin-only outright, even for Billing.
 */
@ApiTags('platform/mailboxes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePlatformRole(['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN'])
@Controller('platform/mailboxes')
export class MailboxesController {
  constructor(private readonly mailboxes: MailboxesService) {}

  @Get()
  async list(@CurrentUser() user: JwtUserPayload) {
    const allowed = accessibleMailboxKeys(user.role);
    const all = await this.mailboxes.list();
    return all.filter((m) => allowed.includes(m.key as MailboxKey));
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Post('request-update-credentials')
  requestUpdateCredentials(@Body() dto: UpdateMailboxCredentialsDto, @CurrentUser() user: JwtUserPayload) {
    return this.mailboxes.requestUpdateCredentials(dto, user.sub);
  }

  @RequirePlatformRole('SUPER_ADMIN')
  @Post('confirm-update-credentials')
  confirmUpdateCredentials(@Body() dto: ConfirmSettingsChangeDto) {
    return this.mailboxes.confirmUpdateCredentials(dto.requestId, dto.code);
  }

  @Get('threads')
  async listThreads(@CurrentUser() user: JwtUserPayload) {
    return this.mailboxes.listThreads(accessibleMailboxKeys(user.role));
  }

  @Get('threads/:threadId')
  async getThread(@Param('threadId') threadId: string, @CurrentUser() user: JwtUserPayload) {
    const thread = await this.mailboxes.getThread(threadId);
    if (!canRoleAccessMailbox(user.role, thread.mailbox.key as MailboxKey)) {
      throw new ForbiddenException('You do not have access to this mailbox');
    }
    return thread;
  }

  @Post('threads/:threadId/read')
  async markThreadRead(@Param('threadId') threadId: string, @CurrentUser() user: JwtUserPayload) {
    const thread = await this.mailboxes.getThread(threadId);
    if (!canRoleAccessMailbox(user.role, thread.mailbox.key as MailboxKey)) {
      throw new ForbiddenException('You do not have access to this mailbox');
    }
    return this.mailboxes.markThreadRead(threadId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('threads/:threadId/reply')
  async reply(@Param('threadId') threadId: string, @Body() dto: ReplyEmailDto, @CurrentUser() user: JwtUserPayload) {
    const thread = await this.mailboxes.getThread(threadId);
    if (!canRoleAccessMailbox(user.role, thread.mailbox.key as MailboxKey)) {
      throw new ForbiddenException('You do not have access to this mailbox');
    }
    return this.mailboxes.sendMessage(
      thread.mailbox.key as MailboxKey,
      { to: thread.participantEmail, subject: thread.subject, body: dto.body, threadId },
      user.sub,
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':key/send')
  send(@Param('key') key: string, @Body() dto: SendEmailDto, @CurrentUser() user: JwtUserPayload) {
    assertKey(key);
    if (!canRoleAccessMailbox(user.role, key)) throw new ForbiddenException('You do not have access to this mailbox');
    return this.mailboxes.sendMessage(key, dto, user.sub);
  }

  @Post(':key/poll-now')
  async pollNow(@Param('key') key: string, @CurrentUser() user: JwtUserPayload) {
    assertKey(key);
    if (!canRoleAccessMailbox(user.role, key)) throw new ForbiddenException('You do not have access to this mailbox');
    await this.mailboxes.pollMailbox(key);
    return { ok: true };
  }
}

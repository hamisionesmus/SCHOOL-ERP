import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { PresenceService } from './presence.service';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ASSISTANT_SUPER_ADMIN']);

/**
 * One lightweight socket per logged-in user, opened app-wide at the layout level (not per-page —
 * see apps/web/src/lib/presence-socket.ts) and kept open for the whole session: connect = online,
 * disconnect = offline, reflected to any watching Super Admin/Assistant Super Admin within a Socket.IO
 * ping-timeout of it actually happening. Auth mirrors TicketsGateway's inline JWT-verify pattern
 * (apps/api/src/tickets/tickets.gateway.ts) — no shared helper exists yet to extract, so this repeats
 * it deliberately rather than inventing a premature abstraction for two call sites.
 */
@WebSocketGateway({ namespace: '/presence', cors: { origin: '*' } })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      client.data.user = payload;

      if (payload.realm === 'platform' && payload.role && ADMIN_ROLES.has(payload.role)) {
        await client.join('admins');
      }

      const wentOnline = await this.presence.register(payload);
      if (wentOnline) await this.broadcastSnapshot();
    } catch {
      this.logger.warn('Rejected presence socket connection: invalid or expired token');
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user: JwtUserPayload | undefined = client.data.user;
    if (!user) return;
    const wentOffline = this.presence.unregister(user);
    if (wentOffline) await this.broadcastSnapshot();
  }

  private async broadcastSnapshot() {
    const snapshot = await this.presence.snapshot();
    this.server.to('admins').emit('presence:snapshot', snapshot);
  }
}

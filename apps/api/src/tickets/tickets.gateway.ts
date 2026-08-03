import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';

interface TicketComment {
  id: string;
  body: string;
  createdAt: string | Date;
  isPlatformReply: boolean;
  platformAuthorName: string | null;
  author: { id: string; fullName: string } | null;
}

/**
 * Single shared gateway for both tenant-side (school/tickets) and platform-side
 * (dashboard/tickets) chat — one Ticket/TicketComment row set is the source of truth either way
 * (see tickets.service.ts / platform-tickets.service.ts), so both sides broadcast into the same
 * `ticket:{ticketId}` room. REST stays the source of truth for persistence; this only fans out the
 * already-persisted result plus ephemeral typing pings — a lost/reconnecting client always sees the
 * full correct history via the existing REST GET on next load.
 */
@WebSocketGateway({ namespace: '/tickets', cors: { origin: '*' } })
export class TicketsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TicketsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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
    } catch {
      this.logger.warn('Rejected socket connection: invalid or expired token');
      client.disconnect();
    }
  }

  @SubscribeMessage('join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { ticketId: string }) {
    if (!client.data.user || !body?.ticketId) return;
    client.join(`ticket:${body.ticketId}`);
  }

  @SubscribeMessage('leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { ticketId: string }) {
    if (!body?.ticketId) return;
    client.leave(`ticket:${body.ticketId}`);
  }

  @SubscribeMessage('typing')
  onTyping(@ConnectedSocket() client: Socket, @MessageBody() body: { ticketId: string }) {
    const user: JwtUserPayload | undefined = client.data.user;
    if (!user || !body?.ticketId) return;
    client.to(`ticket:${body.ticketId}`).emit('typing', { userId: user.sub, fullName: user.fullName });
  }

  emitComment(ticketId: string, comment: TicketComment) {
    this.server.to(`ticket:${ticketId}`).emit('comment:new', comment);
  }

  emitStatusChange(ticketId: string, status: string) {
    this.server.to(`ticket:${ticketId}`).emit('ticket:status', { status });
  }
}

import { Injectable } from '@nestjs/common';
import { PlatformPrismaService } from '../../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';

export interface PresenceEntry {
  userId: string;
  realm: 'platform' | 'tenant';
  fullName: string;
  role?: string;
  roles?: string[];
  tenantSlug?: string;
  schoolName?: string;
  connectedAt: string;
}

export interface PresenceSnapshot {
  onlineNow: number;
  offlineNow: number;
  totalUsers: number;
  online: PresenceEntry[];
}

interface RegisteredUser {
  socketCount: number;
  fullName: string;
  realm: 'platform' | 'tenant';
  role?: string;
  roles?: string[];
  tenantSlug?: string;
  schoolName?: string;
  connectedAt: Date;
  sessionId: string;
}

export interface PresenceSessionHistoryEntry {
  id: string;
  realm: string;
  userId: string;
  fullName: string;
  role: string | null;
  roles: string[] | null;
  tenantSlug: string | null;
  schoolName: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  activities: { path: string; occurredAt: string }[];
}

/**
 * The shared registry behind PresenceGateway (WebSocket lifecycle) and PresenceController (REST
 * fallback/initial-load) — one in-memory source of truth so both always agree. Deliberately
 * in-memory, not a DB table: this app runs a single `api` container today (no replica scaling —
 * see docker-compose.prod.yml), so there's nothing to keep in sync across processes; this would need
 * a shared store (Redis) only if ever horizontally scaled, which isn't being built for speculatively.
 * Deduped by user (realm+sub), not by socket/tab — someone with 3 tabs open is 1 online person, and
 * only their last tab closing flips them offline.
 */
@Injectable()
export class PresenceService {
  private readonly users = new Map<string, RegisteredUser>();
  private tenantNameCache: Map<string, string> | null = null;

  constructor(
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  private key(payload: JwtUserPayload): string {
    return `${payload.realm}:${payload.sub}`;
  }

  private async resolveSchoolName(tenantSlug: string | undefined): Promise<string | undefined> {
    if (!tenantSlug) return undefined;
    if (!this.tenantNameCache) {
      const tenants = await this.platformPrisma.tenant.findMany({
        where: { deletedAt: null },
        select: { slug: true, name: true },
      });
      this.tenantNameCache = new Map(tenants.map((t) => [t.slug, t.name]));
    }
    return this.tenantNameCache.get(tenantSlug);
  }

  /** `wentOnline` is true if this connection just brought a previously-offline user online (0 -> 1
   * sockets, a fresh PresenceSession row) — the gateway only broadcasts the live snapshot on that
   * transition, not on every extra tab. `sessionId` is returned either way (new or already-open) so
   * the caller can log activity against it regardless of which tab triggered the connection. */
  async register(payload: JwtUserPayload): Promise<{ wentOnline: boolean; sessionId: string }> {
    const key = this.key(payload);
    const existing = this.users.get(key);
    if (existing) {
      existing.socketCount += 1;
      return { wentOnline: false, sessionId: existing.sessionId };
    }

    const schoolName = await this.resolveSchoolName(payload.tenantSlug);
    const session = await this.platformPrisma.presenceSession.create({
      data: {
        realm: payload.realm,
        userId: payload.sub,
        fullName: payload.fullName,
        role: payload.role,
        roles: payload.roles ?? undefined,
        tenantSlug: payload.tenantSlug,
        schoolName,
      },
    });
    this.users.set(key, {
      socketCount: 1,
      fullName: payload.fullName,
      realm: payload.realm,
      role: payload.role,
      roles: payload.roles,
      tenantSlug: payload.tenantSlug,
      schoolName,
      connectedAt: session.connectedAt,
      sessionId: session.id,
    });
    return { wentOnline: true, sessionId: session.id };
  }

  /** Returns true if this disconnect just took the user fully offline (last socket closed) —
   * closes out their PresenceSession row for the 24h history view. */
  async unregister(payload: JwtUserPayload): Promise<boolean> {
    const key = this.key(payload);
    const existing = this.users.get(key);
    if (!existing) return false;
    existing.socketCount -= 1;
    if (existing.socketCount <= 0) {
      this.users.delete(key);
      await this.platformPrisma.presenceSession.update({
        where: { id: existing.sessionId },
        data: { disconnectedAt: new Date() },
      });
      return true;
    }
    return false;
  }

  async logActivity(sessionId: string, path: string) {
    await this.platformPrisma.presenceActivity.create({ data: { sessionId, path } });
  }

  /** Last `hours` of sessions (default 24) for the presence History view, most recent first, each
   * with the pages visited during it. */
  async history(hours = 24): Promise<PresenceSessionHistoryEntry[]> {
    const since = new Date(Date.now() - hours * 3_600_000);
    const sessions = await this.platformPrisma.presenceSession.findMany({
      where: { connectedAt: { gte: since } },
      include: { activities: { orderBy: { occurredAt: 'asc' } } },
      orderBy: { connectedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      realm: s.realm,
      userId: s.userId,
      fullName: s.fullName,
      role: s.role,
      roles: (s.roles as string[] | null) ?? null,
      tenantSlug: s.tenantSlug,
      schoolName: s.schoolName,
      connectedAt: s.connectedAt.toISOString(),
      disconnectedAt: s.disconnectedAt?.toISOString() ?? null,
      activities: s.activities.map((a) => ({ path: a.path, occurredAt: a.occurredAt.toISOString() })),
    }));
  }

  /** Keeps PresenceSession/PresenceActivity from growing forever — same cron-cleanup precedent as
   * RemindersService/backup archiving elsewhere in this codebase. History only needs to cover the
   * last 24h; 7 days of retention leaves comfortable slack. */
  async pruneOldSessions() {
    const cutoff = new Date(Date.now() - 7 * 86_400_000);
    await this.platformPrisma.presenceSession.deleteMany({ where: { connectedAt: { lt: cutoff } } });
  }

  /** Same tenant-schema fan-out pattern already used by
   * SystemHealthService.dailyActiveLoginsLast7Days()/schoolsStorageStats() — platform users plus
   * every school's own user count, summed. Not cached: presence-dashboard views are infrequent,
   * not a hot path, and school counts are small (same assumption those methods already make). */
  private async totalUserCount(): Promise<number> {
    const [platformCount, tenants] = await Promise.all([
      this.platformPrisma.platformUser.count({ where: { deletedAt: null } }),
      this.platformPrisma.tenant.findMany({ where: { deletedAt: null }, select: { schemaName: true } }),
    ]);
    const tenantCounts = await Promise.all(
      tenants.map((t) => this.tenantPrisma.forSchema(t.schemaName).user.count()),
    );
    return platformCount + tenantCounts.reduce((sum, n) => sum + n, 0);
  }

  async snapshot(): Promise<PresenceSnapshot> {
    const totalUsers = await this.totalUserCount();
    const online: PresenceEntry[] = Array.from(this.users.entries()).map(([key, u]) => ({
      userId: key.split(':').slice(1).join(':'),
      realm: u.realm,
      fullName: u.fullName,
      role: u.role,
      roles: u.roles,
      tenantSlug: u.tenantSlug,
      schoolName: u.schoolName,
      connectedAt: u.connectedAt.toISOString(),
    }));
    const onlineNow = online.length;
    return { onlineNow, offlineNow: Math.max(0, totalUsers - onlineNow), totalUsers, online };
  }
}

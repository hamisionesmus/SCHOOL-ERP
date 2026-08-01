import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
import { UserDirectoryService } from '../common/user-directory/user-directory.service';
import { LoginDto } from './dto/login.dto';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Strips JWT standard claims (iat/exp/jti) so a decoded token can be safely re-signed. */
function cleanPayload(decoded: JwtUserPayload): JwtUserPayload {
  const { sub, realm, email, fullName, tenantSchema, tenantSlug, roles, permissions } = decoded;
  return { sub, realm, email, fullName, tenantSchema, tenantSlug, roles, permissions };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly platformPrisma: PlatformPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly userDirectory: UserDirectoryService,
  ) {}

  /** No school slug needed from the user: the email decides where to look. A PlatformUser match
   * means a Super Admin login; otherwise the cross-school directory (see UserDirectoryService)
   * resolves which school's schema to check instead. Routing this way — checking *which account
   * exists* first, rather than "try platform, fall back on failure" — matters so a normal tenant
   * user's login doesn't record a bogus failed-platform-login attempt on every single sign-in (that
   * would pollute the failed-login burst detector below). The tenantSlug DTO field still works too,
   * kept for the rare case a directory lookup can't resolve (e.g. data older than the backfill) —
   * it just no longer needs to be surfaced in the UI. */
  async login(dto: LoginDto, ipAddress?: string): Promise<TokenPair & { user: JwtUserPayload }> {
    if (dto.tenantSlug) {
      return this.loginTenant(dto.tenantSlug, dto.email, dto.password, ipAddress);
    }

    const platformUser = await this.platformPrisma.platformUser.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (platformUser) {
      return this.loginPlatform(dto.email, dto.password, ipAddress, platformUser);
    }

    const resolvedSlug = await this.userDirectory.findTenantSlugByEmail(dto.email);
    if (resolvedSlug) {
      return this.loginTenant(resolvedSlug, dto.email, dto.password, ipAddress);
    }

    await this.recordFailedAttempt(dto.email, null, ipAddress);
    throw new UnauthorizedException('Invalid credentials');
  }

  private static readonly FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
  private static readonly FAILED_LOGIN_THRESHOLD = 5;

  /** Records one failed attempt, then checks whether this (email, realm) has crossed the burst
   * threshold within the rolling window — if so, raises exactly one SecurityAlert per burst (checked
   * by seeing if an unacknowledged alert already exists for this key within the window) rather than
   * one alert per failed attempt, which would just be noise for the Super Admin to wade through. */
  private async recordFailedAttempt(email: string, tenantSlug: string | null, ipAddress?: string) {
    const windowStart = new Date(Date.now() - AuthService.FAILED_LOGIN_WINDOW_MS);
    await this.platformPrisma.failedLoginAttempt.create({
      data: { email, tenantSlug: tenantSlug ?? undefined, ipAddress },
    });

    const count = await this.platformPrisma.failedLoginAttempt.count({
      where: { email, tenantSlug: tenantSlug ?? null, createdAt: { gte: windowStart } },
    });
    if (count < AuthService.FAILED_LOGIN_THRESHOLD) return;

    const existingAlert = await this.platformPrisma.securityAlert.findFirst({
      where: { type: 'REPEATED_FAILED_LOGIN', email, tenantSlug: tenantSlug ?? null, createdAt: { gte: windowStart } },
    });
    if (existingAlert) return;

    await this.platformPrisma.securityAlert.create({
      data: {
        type: 'REPEATED_FAILED_LOGIN',
        severity: count >= AuthService.FAILED_LOGIN_THRESHOLD * 2 ? 'HIGH' : 'MEDIUM',
        email,
        tenantSlug: tenantSlug ?? undefined,
        ipAddress,
        attemptCount: count,
        details: `${count} failed login attempts for ${email}${tenantSlug ? ` (school: ${tenantSlug})` : ' (Super Admin login)'} within 15 minutes`,
      },
    });
  }

  private async loginPlatform(
    email: string,
    password: string,
    ipAddress: string | undefined,
    user: { id: string; email: string; fullName: string; passwordHash: string },
  ) {
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await this.recordFailedAttempt(email, null, ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtUserPayload = {
      sub: user.id,
      realm: 'platform',
      email: user.email,
      fullName: user.fullName,
    };
    const tokens = await this.issueTokens(payload);
    await this.storeRefreshToken('platform', user.id, tokens.refreshToken);
    return { ...tokens, user: payload };
  }

  private async loginTenant(tenantSlug: string, email: string, password: string, ipAddress?: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { slug: tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new UnauthorizedException('Unknown school');

    // Demo accounts are time-boxed at creation (see TenantsService.confirmCreate) and there's no
    // background job in this environment to flip their status the moment they lapse, so it's
    // enforced live here — and opportunistically persisted as SUSPENDED so the Super Admin dashboard
    // reflects it after the first blocked login attempt, not just in-memory for this request.
    if (tenant.isDemo && tenant.demoExpiresAt && tenant.demoExpiresAt < new Date() && tenant.status !== 'SUSPENDED') {
      await this.platformPrisma.tenant.update({ where: { id: tenant.id }, data: { status: 'SUSPENDED' } });
      tenant.status = 'SUSPENDED';
    }

    if (tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        tenant.isDemo ? 'This demo account has expired' : 'This school account is suspended',
      );
    }

    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const user = await db.user.findFirst({ where: { email, deletedAt: null } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      await this.recordFailedAttempt(email, tenantSlug, ipAddress);
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRoles = await db.userRole.findMany({
      where: { userId: user.id },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const roles = userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
      ),
    ];

    const payload: JwtUserPayload = {
      sub: user.id,
      realm: 'tenant',
      email: user.email,
      fullName: user.fullName,
      tenantSchema: tenant.schemaName,
      tenantSlug: tenant.slug,
      roles,
      permissions,
    };
    const tokens = await this.issueTokens(payload);
    await this.storeRefreshToken('tenant', user.id, tokens.refreshToken, tenant.schemaName);
    return { ...tokens, user: payload };
  }

  async refresh(refreshToken: string): Promise<TokenPair & { user: JwtUserPayload }> {
    let decoded: JwtUserPayload;
    try {
      decoded = await this.jwt.verifyAsync<JwtUserPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(refreshToken);

    if (decoded.realm === 'platform') {
      const stored = await this.platformPrisma.platformRefreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token revoked or expired');
      }
      await this.platformPrisma.platformRefreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      return this.loginPlatformDirect(cleanPayload(decoded));
    }

    if (!decoded.tenantSchema) throw new UnauthorizedException('Malformed refresh token');
    const db = this.tenantPrisma.forSchema(decoded.tenantSchema);
    const stored = await db.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }
    await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    // Re-resolve current roles/permissions rather than trusting the old token's snapshot.
    const userRoles = await db.userRole.findMany({
      where: { userId: decoded.sub },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const payload: JwtUserPayload = {
      ...cleanPayload(decoded),
      roles: userRoles.map((ur) => ur.role.name),
      permissions: [
        ...new Set(userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code))),
      ],
    };
    const tokens = await this.issueTokens(payload);
    await this.storeRefreshToken('tenant', decoded.sub, tokens.refreshToken, decoded.tenantSchema);
    return { ...tokens, user: payload };
  }

  private async loginPlatformDirect(payload: JwtUserPayload) {
    const tokens = await this.issueTokens(payload);
    await this.storeRefreshToken('platform', payload.sub, tokens.refreshToken);
    return { ...tokens, user: payload };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    try {
      const decoded = this.jwt.decode(refreshToken) as JwtUserPayload | null;
      if (!decoded) return;
      if (decoded.realm === 'platform') {
        await this.platformPrisma.platformRefreshToken
          .updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } })
          .catch(() => undefined);
      } else if (decoded.tenantSchema) {
        await this.tenantPrisma
          .forSchema(decoded.tenantSchema)
          .refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } })
          .catch(() => undefined);
      }
    } catch {
      // best-effort logout; an already-invalid token needs no revocation
    }
  }

  private async issueTokens(payload: JwtUserPayload): Promise<TokenPair> {
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
      },
    );
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    realm: 'platform' | 'tenant',
    userId: string,
    refreshToken: string,
    tenantSchema?: string,
  ) {
    const tokenHash = hashToken(refreshToken);
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    if (realm === 'platform') {
      await this.platformPrisma.platformRefreshToken.create({
        data: { tokenHash, platformUserId: userId, expiresAt },
      });
    } else if (tenantSchema) {
      await this.tenantPrisma.forSchema(tenantSchema).refreshToken.create({
        data: { tokenHash, userId, expiresAt },
      });
    }
  }
}

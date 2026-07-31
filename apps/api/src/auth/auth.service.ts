import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { TenantPrismaService } from '../common/prisma/tenant-prisma.service';
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
  ) {}

  async login(dto: LoginDto): Promise<TokenPair & { user: JwtUserPayload }> {
    if (dto.tenantSlug) {
      return this.loginTenant(dto.tenantSlug, dto.email, dto.password);
    }
    return this.loginPlatform(dto.email, dto.password);
  }

  private async loginPlatform(email: string, password: string) {
    const user = await this.platformPrisma.platformUser.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
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

  private async loginTenant(tenantSlug: string, email: string, password: string) {
    const tenant = await this.platformPrisma.tenant.findFirst({
      where: { slug: tenantSlug, deletedAt: null },
    });
    if (!tenant) throw new UnauthorizedException('Unknown school');
    if (tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException('This school account is suspended');
    }

    const db = this.tenantPrisma.forSchema(tenant.schemaName);
    const user = await db.user.findFirst({ where: { email, deletedAt: null } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
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

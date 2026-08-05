import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PlatformPrismaService } from '../../../common/prisma/platform-prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Lets Hamzone's own public website (or any other third-party system) read select CRM data
 * without a human login session — see HamzoneApiKey's schema doc comment. Only the SHA-256 hash is
 * ever stored; the real key is shown exactly once, at creation, same "never retrievable again"
 * precedent as every other secret in this codebase (e.g. temp passwords).
 */
@Injectable()
export class HamzoneApiKeysService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  list() {
    return this.platformPrisma.hamzoneApiKey.findMany({
      select: {
        id: true,
        label: true,
        keyPreview: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateApiKeyDto, userId: string) {
    const rawKey = `hz_live_${randomBytes(24).toString('hex')}`;
    const keyHash = hashKey(rawKey);
    const keyPreview = `…${rawKey.slice(-4)}`;
    await this.platformPrisma.hamzoneApiKey.create({
      data: { label: dto.label, keyHash, keyPreview, scopes: dto.scopes, createdByUserId: userId },
    });
    // The only time the raw key is ever returned — the caller must copy it now.
    return { key: rawKey };
  }

  async revoke(id: string) {
    const existing = await this.platformPrisma.hamzoneApiKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('API key not found');
    return this.platformPrisma.hamzoneApiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Verifies a raw key from the `X-API-Key` header against the stored hash, checks it isn't
   * revoked, confirms it carries the required scope, and stamps lastUsedAt — used by
   * HamzoneApiKeyGuard on every request to a /public/api/v1/... endpoint. */
  async verify(rawKey: string, requiredScope: string) {
    const keyHash = hashKey(rawKey);
    const record = await this.platformPrisma.hamzoneApiKey.findUnique({ where: { keyHash } });
    if (!record || record.revokedAt) throw new BadRequestException('Invalid or revoked API key');
    if (!record.scopes.includes(requiredScope)) throw new BadRequestException(`This API key does not have the "${requiredScope}" scope`);
    await this.platformPrisma.hamzoneApiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return record;
  }
}

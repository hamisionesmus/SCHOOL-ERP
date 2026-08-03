import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { PlatformPrismaService } from '../common/prisma/platform-prisma.service';
import { computeTenantStorageBytes } from '../common/storage-usage.util';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico']);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Local-disk upload stub for display images (school logos, student photos). Swap-in point for
 * production: implement the same `save()` signature against S3-compatible object storage (see
 * docs/ARCHITECTURE.md tech-stack table) — nothing outside this service needs to change.
 */
@Injectable()
export class UploadsService {
  constructor(private readonly platformPrisma: PlatformPrismaService) {}

  async save(scope: string, file: Express.Multer.File): Promise<{ url: string }> {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Only JPG, PNG, WEBP, SVG, or ICO images are allowed');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File must be under 5MB');
    }

    // `scope` is 'platform' for platform-side branding assets (no tenant to check against) or a
    // real tenant schemaName for school-side uploads (logos, student photos) — see
    // uploads.controller.ts. Only the latter has a storage cap to enforce.
    if (scope !== 'platform') {
      const tenant = await this.platformPrisma.tenant.findUnique({
        where: { schemaName: scope },
        select: { storageLimitMbOverride: true },
      });
      if (tenant?.storageLimitMbOverride != null) {
        const { totalBytes } = await computeTenantStorageBytes(this.platformPrisma, scope);
        const projectedMb = (totalBytes + file.size) / 1024 / 1024;
        if (projectedMb > tenant.storageLimitMbOverride) {
          throw new PayloadTooLargeException(
            `This school has reached its storage limit (${tenant.storageLimitMbOverride} MB). Ask the Super Admin to increase the limit or upgrade the plan before uploading more.`,
          );
        }
      }
    }

    const dir = join(process.cwd(), 'uploads', scope);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(dir, filename), file.buffer);

    return { url: `/uploads/${scope}/${filename}` };
  }
}

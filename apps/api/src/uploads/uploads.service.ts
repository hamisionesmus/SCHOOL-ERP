import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Local-disk upload stub for display images (school logos, student photos). Swap-in point for
 * production: implement the same `save()` signature against S3-compatible object storage (see
 * docs/ARCHITECTURE.md tech-stack table) — nothing outside this service needs to change.
 */
@Injectable()
export class UploadsService {
  save(scope: string, file: Express.Multer.File): { url: string } {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Only JPG, PNG, or WEBP images are allowed');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File must be under 5MB');
    }

    const dir = join(process.cwd(), 'uploads', scope);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    writeFileSync(join(dir, filename), file.buffer);

    return { url: `/uploads/${scope}/${filename}` };
  }
}

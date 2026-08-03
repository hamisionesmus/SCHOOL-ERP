import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  kind: 'database' | 'uploads';
  archived: boolean;
}

const ARCHIVE_AFTER_MS = 48 * 3_600_000; // never deleted, just compressed + relocated after this age

@Injectable()
export class BackupsService {
  private readonly logger = new Logger('Backups');
  private readonly backupsDir = join(process.cwd(), 'backups');
  private readonly archiveDir = join(this.backupsDir, 'archive');

  constructor(private readonly scheduler: SchedulerRegistry) {}

  private filesIn(dir: string, archived: boolean): BackupFile[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.sql') || f.endsWith('.sql.gz') || f.endsWith('.tar.gz'))
      .map((name) => {
        const stat = statSync(join(dir, name));
        return {
          name,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          kind: name.startsWith('db-') ? ('database' as const) : ('uploads' as const),
          archived,
        };
      });
  }

  private allFiles(): BackupFile[] {
    return [...this.filesIn(this.backupsDir, false), ...this.filesIn(this.archiveDir, true)].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  list(page = 1, pageSize = 10) {
    const all = this.allFiles();
    const data = all.slice((page - 1) * pageSize, page * pageSize);
    return { data, meta: { page, pageSize, total: all.length } };
  }

  stats() {
    const all = this.allFiles();
    return {
      totalCount: all.length,
      totalSizeBytes: all.reduce((sum, f) => sum + f.sizeBytes, 0),
      lastBackupAt: all[0]?.createdAt ?? null,
      nextBackupAt: this.nextBackupAt(),
    };
  }

  /** Exact next-fire time from the cron job's own schedule, not an approximated "top of the next
   * hour" guess — nextDate() may return a Luxon DateTime (cron v3, used by @nestjs/schedule v6) or a
   * plain Date depending on version, so this normalizes either shape. */
  private nextBackupAt(): string | null {
    try {
      const job = this.scheduler.getCronJob('hourlyBackup');
      const next = job.nextDate();
      const date = typeof (next as { toJSDate?: () => Date }).toJSDate === 'function'
        ? (next as { toJSDate: () => Date }).toJSDate()
        : (next as unknown as Date);
      return date.toISOString();
    } catch {
      return null;
    }
  }

  /** Resolves a backup filename to an absolute path for download, rejecting anything that isn't a
   * plain filename already present in the backups directory (or its archive subdirectory) — blocks
   * path traversal (`../`) and absolute-path injection outright rather than trying to sanitize them. */
  resolvePath(filename: string): string {
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    if (existsSync(join(this.backupsDir, filename))) return join(this.backupsDir, filename);
    if (existsSync(join(this.archiveDir, filename))) return join(this.archiveDir, filename);
    throw new NotFoundException('Backup file not found');
  }

  /** Kicks off prisma/backup-database.ts in the background and returns immediately — pg_dump of the
   * whole cluster can take a while at real scale, so this doesn't block the request. Check `list()`
   * a few seconds later for the new files. Requires `pg_dump` (and `tar`, for the uploads archive) on
   * PATH — see apps/api/Dockerfile's postgresql16-client package; if missing, the failure is logged
   * here rather than silently doing nothing. */
  trigger(): { started: true } {
    const child = execFile(
      'npx',
      ['ts-node', '-r', 'tsconfig-paths/register', 'prisma/backup-database.ts'],
      { cwd: process.cwd(), shell: true },
      (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`Backup run failed: ${error.message}\n${stderr}`);
        } else {
          this.logger.log(`Backup run completed.\n${stdout}`);
        }
      },
    );
    child.unref();
    return { started: true };
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'hourlyBackup' })
  hourlyBackup() {
    this.logger.log('Starting scheduled hourly backup...');
    this.trigger();
  }

  /** Never deletes anything — compresses `.sql` dumps in place (uploads `.tar.gz` files are already
   * compressed) and relocates anything older than 48h into backups/archive/, still fully listable
   * and downloadable from there (see allFiles()/resolvePath() above). Runs once daily; safe to run
   * more often since it's a no-op once a file has already been archived. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  archiveOldBackups() {
    if (!existsSync(this.backupsDir)) return;
    if (!existsSync(this.archiveDir)) mkdirSync(this.archiveDir, { recursive: true });

    const cutoff = Date.now() - ARCHIVE_AFTER_MS;
    let archivedCount = 0;

    for (const name of readdirSync(this.backupsDir)) {
      const path = join(this.backupsDir, name);
      const stat = statSync(path);
      if (!stat.isFile()) continue;
      if (stat.mtimeMs > cutoff) continue;

      if (name.endsWith('.sql')) {
        const gzName = `${name}.gz`;
        const compressed = gzipSync(readFileSync(path));
        writeFileSync(join(this.archiveDir, gzName), compressed);
        rmSync(path);
        archivedCount++;
      } else if (name.endsWith('.sql.gz') || name.endsWith('.tar.gz')) {
        renameSync(path, join(this.archiveDir, name));
        archivedCount++;
      }
    }

    if (archivedCount > 0) this.logger.log(`Archived ${archivedCount} backup file(s) older than 48h.`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  kind: 'database' | 'uploads';
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger('Backups');
  private readonly backupsDir = join(process.cwd(), 'backups');

  list(): BackupFile[] {
    if (!existsSync(this.backupsDir)) return [];
    return readdirSync(this.backupsDir)
      .filter((f) => f.endsWith('.sql') || f.endsWith('.tar.gz'))
      .map((name) => {
        const stat = statSync(join(this.backupsDir, name));
        return {
          name,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          kind: name.startsWith('db-') ? ('database' as const) : ('uploads' as const),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Kicks off prisma/backup-database.ts in the background and returns immediately — pg_dump of the
   * whole cluster can take a while at real scale, so this doesn't block the request. Check `list()`
   * a few seconds later for the new files. Requires `pg_dump` (and `tar`, for the uploads archive) on
   * PATH; if they're missing, the failure is logged here rather than silently doing nothing. */
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
}

/**
 * Backs up the whole Postgres database (the `public` platform schema plus every tenant schema all
 * live in one Postgres database under schema-per-tenant — see docs/ARCHITECTURE.md §2 — so a single
 * `pg_dump` of the database covers every school) and the local-disk uploads folder to timestamped
 * files under `backups/`. Run manually (`npm run backup`) or on a schedule via cron / Windows Task
 * Scheduler — see docs/ARCHITECTURE.md for the exact scheduling commands.
 *
 * Postgres runs in the `postgres` Docker Compose service (see docker-compose.yml), not installed on
 * the host, so `pg_dump` is invoked *inside* that container via `docker compose exec` rather than
 * assuming a host-installed Postgres client toolchain — the earlier host-pg_dump approach failed with
 * ENOENT on a plain Windows/macOS host with no local Postgres install.
 *
 * This script does not upload anywhere; wiring it to S3/GCS/etc. is a deployment-specific follow-up,
 * not something this repo can do without real cloud credentials.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config();

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const { user, password, database } = parseDatabaseUrl(databaseUrl);

  const repoRoot = join(process.cwd(), '..', '..');
  const backupsDir = join(process.cwd(), 'backups');
  if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });

  const stamp = timestamp();
  const sqlPath = join(backupsDir, `db-${database}-${stamp}.sql`);

  console.log(`Dumping database "${database}" (all schemas) via the postgres container to ${sqlPath} ...`);
  const dump = execFileSync(
    'docker',
    [
      'compose', '--project-directory', repoRoot, 'exec', '-T', '-e', `PGPASSWORD=${password}`,
      'postgres', 'pg_dump', '-U', user, '-F', 'p', database,
    ],
    { maxBuffer: 1024 * 1024 * 512 },
  );
  writeFileSync(sqlPath, dump);

  const uploadsDir = join(process.cwd(), 'uploads');
  if (existsSync(uploadsDir)) {
    const archivePath = join(backupsDir, `uploads-${stamp}.tar.gz`);
    console.log(`Archiving uploads/ to ${archivePath} ...`);
    try {
      // --force-local: Windows' built-in tar.exe (bsdtar) otherwise misreads an absolute path with a
      // drive letter (e.g. "C:\...") as a "host:path" remote-shell target and tries to SSH to "C".
      execFileSync('tar', ['--force-local', '-czf', archivePath, '-C', process.cwd(), 'uploads']);
    } catch (err) {
      console.warn(`Skipped uploads archive — 'tar' is not available on this host: ${(err as Error).message}`);
    }
  }

  console.log('Backup complete.');
  console.log('Reminder: this script only writes local files — copy backups/ off-box regularly.');
}

main();

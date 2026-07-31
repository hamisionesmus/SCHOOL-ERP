/**
 * Backs up the whole Postgres database (the `public` platform schema plus every tenant schema all
 * live in one Postgres database under schema-per-tenant — see docs/ARCHITECTURE.md §2 — so a single
 * `pg_dump` of the database covers every school) and the local-disk uploads folder to timestamped
 * files under `backups/`. Run manually (`npx ts-node prisma/backup-database.ts`) or on a schedule via
 * cron / Windows Task Scheduler — see docs/ARCHITECTURE.md for the exact scheduling commands. This
 * script does not upload anywhere; wiring it to S3/GCS/etc. is a deployment-specific follow-up, not
 * something this repo can do without real cloud credentials.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config();

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const { host, port, user, password, database } = parseDatabaseUrl(databaseUrl);

  const backupsDir = join(process.cwd(), 'backups');
  if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });

  const stamp = timestamp();
  const sqlPath = join(backupsDir, `db-${database}-${stamp}.sql`);

  console.log(`Dumping database "${database}" (all schemas) to ${sqlPath} ...`);
  execFileSync('pg_dump', ['-h', host, '-p', port, '-U', user, '-F', 'p', '-f', sqlPath, database], {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'inherit',
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  if (existsSync(uploadsDir)) {
    const archivePath = join(backupsDir, `uploads-${stamp}.tar.gz`);
    console.log(`Archiving uploads/ to ${archivePath} ...`);
    execFileSync('tar', ['-czf', archivePath, '-C', process.cwd(), 'uploads'], { stdio: 'inherit' });
  }

  console.log('Backup complete.');
  console.log('Reminder: this script only writes local files — copy backups/ off-box regularly.');
}

main();

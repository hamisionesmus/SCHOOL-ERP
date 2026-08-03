/**
 * Backs up the whole Postgres database (the `public` platform schema plus every tenant schema all
 * live in one Postgres database under schema-per-tenant — see docs/ARCHITECTURE.md §2 — so a single
 * `pg_dump` of the database covers every school) and the local-disk uploads folder to timestamped
 * files under `backups/`. Called by BackupsService.trigger() — both the manual "Run backup now"
 * button and the hourly @Cron job in production — as well as runnable standalone (`npm run backup`).
 *
 * `pg_dump` is invoked directly against the `postgres` service over the docker network (host/port
 * parsed straight out of DATABASE_URL), not via `docker compose exec` — the previous approach only
 * worked when this script ran on the Docker *host* with the `docker` CLI on PATH. Since
 * BackupsService actually runs this from *inside* the already-running `api` container (which has
 * neither Docker CLI nor socket access), that path silently failed there; this direct-`pg_dump`
 * approach works identically whether invoked from inside the container (prod, via the cron/button)
 * or from a host machine that happens to have the `postgresql-client` package installed and can
 * reach the `postgres` service's exposed port.
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
    host: u.hostname,
    port: u.port || '5432',
  };
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  const { user, password, database, host, port } = parseDatabaseUrl(databaseUrl);

  const backupsDir = join(process.cwd(), 'backups');
  if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });

  const stamp = timestamp();
  const sqlPath = join(backupsDir, `db-${database}-${stamp}.sql`);

  console.log(`Dumping database "${database}" (all schemas) from ${host}:${port} to ${sqlPath} ...`);
  const dump = execFileSync(
    'pg_dump',
    ['-h', host, '-p', port, '-U', user, '-F', 'p', database],
    { env: { ...process.env, PGPASSWORD: password }, maxBuffer: 1024 * 1024 * 512 },
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

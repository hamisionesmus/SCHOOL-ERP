import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';

/**
 * Creates a new Postgres schema for a tenant and applies the tenant Prisma migrations to it via the
 * `prisma migrate deploy` CLI (not a raw-SQL replay): Prisma tracks applied migrations per schema in
 * that schema's own `_prisma_migrations` table, so deployMigrations() is safe to call repeatedly —
 * on a brand-new tenant it applies everything; on an already-provisioned one (after a new migration
 * is added in a later phase) it applies only what's missing. See prisma/migrate-all-tenants.ts for
 * the backfill entry point and docs/ARCHITECTURE.md §2.
 */
@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(private readonly config: ConfigService) {}

  async provisionSchema(schemaName: string): Promise<void> {
    const client = new Client({ connectionString: this.config.getOrThrow<string>('DATABASE_URL') });
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    } finally {
      await client.end();
    }
    this.deployMigrations(schemaName);
  }

  deployMigrations(schemaName: string): void {
    const baseUrl = this.config.getOrThrow<string>('DATABASE_URL');
    const url = new URL(baseUrl);
    url.searchParams.set('schema', schemaName);

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=prisma/tenant/schema.prisma'], {
      cwd: process.cwd(),
      env: { ...process.env, TENANT_TEMPLATE_DATABASE_URL: url.toString() },
      stdio: 'pipe',
      shell: true,
    });
    this.logger.log(`Migrations deployed to schema ${schemaName}`);
  }
}

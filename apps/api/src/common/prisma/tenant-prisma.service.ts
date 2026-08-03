import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/tenant-client';

/**
 * Every cached client opens its own Prisma connection pool — with many tenant schemas active,
 * MAX_CACHED_CLIENTS × DB_POOL_PER_TENANT is the worst-case connection count this service alone can
 * hold open against Postgres, so both are kept small and env-configurable (see docker-compose.prod.yml
 * for the matching Postgres `max_connections` tuning these defaults are sized against).
 */
const MAX_CACHED_CLIENTS = Number(process.env.DB_MAX_CACHED_TENANT_CLIENTS ?? 15);
const POOL_PER_TENANT = Number(process.env.DB_POOL_PER_TENANT ?? 3);

/**
 * Opens (and caches, LRU-ish by insertion order) one PrismaClient per tenant schema.
 * Each client's connection string is the shared DATABASE_URL with `schema=<tenant schema>`
 * appended, so every query issued through it runs with that schema on the Postgres search_path.
 * This is what makes cross-tenant data access structurally impossible from application code:
 * a request bound to tenant A's client has no path to tenant B's tables.
 */
@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly clients = new Map<string, PrismaClient>();

  constructor(private readonly config: ConfigService) {}

  forSchema(schemaName: string): PrismaClient {
    let client = this.clients.get(schemaName);
    if (client) return client;

    if (this.clients.size >= MAX_CACHED_CLIENTS) {
      const oldestKey = this.clients.keys().next().value;
      if (oldestKey) {
        void this.clients.get(oldestKey)?.$disconnect();
        this.clients.delete(oldestKey);
      }
    }

    const baseUrl = this.config.getOrThrow<string>('DATABASE_URL');
    const url = new URL(baseUrl);
    url.searchParams.set('schema', schemaName);
    url.searchParams.set('connection_limit', String(POOL_PER_TENANT));

    client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    this.clients.set(schemaName, client);
    return client;
  }

  async onModuleDestroy() {
    await Promise.all([...this.clients.values()].map((c) => c.$disconnect()));
  }
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/tenant-client';

const MAX_CACHED_CLIENTS = 50;

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

    client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    this.clients.set(schemaName, client);
    return client;
  }

  async onModuleDestroy() {
    await Promise.all([...this.clients.values()].map((c) => c.$disconnect()));
  }
}

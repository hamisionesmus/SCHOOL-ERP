import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../generated/platform-client';

const POOL_PLATFORM = Number(process.env.DB_POOL_PLATFORM ?? 8);

function buildDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const url = new URL(base);
  url.searchParams.set('connection_limit', String(POOL_PLATFORM));
  return url.toString();
}

@Injectable()
export class PlatformPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = buildDatasourceUrl();
    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

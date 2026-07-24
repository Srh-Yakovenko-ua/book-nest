import { Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

const POOL_MAX_CONNECTIONS = 10;
const POOL_CONNECTION_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 30_000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown, OnModuleInit {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: env.databaseUrl,
        connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
        idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
        max: POOL_MAX_CONNECTIONS,
        statement_timeout: STATEMENT_TIMEOUT_MS,
      }),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}

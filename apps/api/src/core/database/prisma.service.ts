import { Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

const POOL_MAX_CONNECTIONS = 10;
const POOL_CONNECTION_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 30_000;
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000;

const QUERY_EVENT_LOG_OPTION = { emit: "event", level: "query" } as const;

export type PrismaQueryEvent = {
  duration: number;
  query: string;
};

type QueryEventClientOptions = {
  adapter: PrismaPg;
  log: [typeof QUERY_EVENT_LOG_OPTION];
};

@Injectable()
export class PrismaService
  extends PrismaClient<QueryEventClientOptions>
  implements OnApplicationShutdown, OnModuleInit
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: env.databaseUrl,
        connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
        idle_in_transaction_session_timeout: IDLE_IN_TRANSACTION_TIMEOUT_MS,
        max: POOL_MAX_CONNECTIONS,
        statement_timeout: STATEMENT_TIMEOUT_MS,
      }),
      log: [QUERY_EVENT_LOG_OPTION],
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  onQuery(listener: (event: PrismaQueryEvent) => void): void {
    this.$on("query", listener);
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}

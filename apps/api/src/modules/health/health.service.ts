import type { ApiHealth, ApiLiveness } from "@app/shared";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

import { PrismaService } from "../../core/database/prisma.service.js";
import { HEALTH_QUEUE_NAME } from "./health-queue.js";

const PG_HEALTHCHECK_TIMEOUT_MS = 1000;
const REDIS_HEALTHCHECK_TIMEOUT_MS = 1000;

type DependencyProbes = Pick<ApiHealth, "postgres" | "redis">;

type ProcessSnapshot = Pick<ApiHealth, "timestamp" | "uptimeSeconds">;

@Injectable()
export class HealthService {
  constructor(
    @InjectQueue(HEALTH_QUEUE_NAME) private readonly healthQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async getHealth(): Promise<ApiHealth> {
    const probes = await this.probeDependencies();

    return {
      ...probes,
      ...this.buildProcessSnapshot(),
      status: probes.postgres === "ok" ? "ok" : "degraded",
    };
  }

  getLiveness(): ApiLiveness {
    return {
      ...this.buildProcessSnapshot(),
      status: "ok",
    };
  }

  async getReadiness(): Promise<ApiHealth> {
    const probes = await this.probeDependencies();
    const dependenciesReady = probes.postgres === "ok" && probes.redis === "ok";

    return {
      ...probes,
      ...this.buildProcessSnapshot(),
      status: dependenciesReady ? "ok" : "degraded",
    };
  }

  private buildProcessSnapshot(): ProcessSnapshot {
    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  private async pingPostgres(): Promise<"down" | "ok"> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const queryPromise = this.prisma.ping();
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("postgres healthcheck timeout")),
          PG_HEALTHCHECK_TIMEOUT_MS,
        );
      });
      await Promise.race([queryPromise, timeoutPromise]);
      return "ok";
    } catch {
      return "down";
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private async pingRedis(): Promise<"down" | "ok"> {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const pingPromise = this.pingRedisClient();
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("redis healthcheck timeout")),
          REDIS_HEALTHCHECK_TIMEOUT_MS,
        );
      });
      await Promise.race([pingPromise, timeoutPromise]);
      return "ok";
    } catch {
      return "down";
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private async pingRedisClient(): Promise<void> {
    const client = await this.healthQueue.client;
    await client.info();
  }

  private async probeDependencies(): Promise<DependencyProbes> {
    const [postgres, redis] = await Promise.all([this.pingPostgres(), this.pingRedis()]);

    return { postgres, redis };
  }
}

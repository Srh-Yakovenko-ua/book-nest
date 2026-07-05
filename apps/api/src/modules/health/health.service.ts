import type { ApiHealth } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../core/database/prisma.service.js";

const PG_HEALTHCHECK_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<ApiHealth> {
    const postgres = await this.pingPostgres();
    return {
      postgres,
      status: postgres === "ok" ? "ok" : "degraded",
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
}

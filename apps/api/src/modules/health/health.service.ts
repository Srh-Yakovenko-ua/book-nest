import type { ApiHealth } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const PG_HEALTHCHECK_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
      const queryPromise = this.dataSource.query("SELECT 1");
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

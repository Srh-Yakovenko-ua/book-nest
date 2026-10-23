import type { Queue } from "bullmq";

import { describe, expect, it } from "vitest";

import type { PrismaService } from "../../core/database/prisma.service.js";

import { HealthService } from "./health.service.js";

function buildService(config: {
  clientInfo: () => Promise<string>;
  pingPostgres: () => Promise<void>;
}): HealthService {
  const queue = { client: Promise.resolve({ info: config.clientInfo }) } as unknown as Queue;
  const prisma = { ping: config.pingPostgres } as unknown as PrismaService;
  return new HealthService(queue, prisma);
}

describe("HealthService.getHealth", () => {
  it("reports ok for postgres and redis when both respond", async () => {
    const service = buildService({
      clientInfo: async () => "redis_version:7",
      pingPostgres: async () => undefined,
    });

    const health = await service.getHealth();

    expect(health.postgres).toBe("ok");
    expect(health.redis).toBe("ok");
    expect(health.status).toBe("ok");
    expect(typeof health.timestamp).toBe("string");
    expect(typeof health.uptimeSeconds).toBe("number");
  });

  it("reports redis down but keeps status ok when only redis fails", async () => {
    const service = buildService({
      clientInfo: async () => {
        throw new Error("redis unreachable");
      },
      pingPostgres: async () => undefined,
    });

    const health = await service.getHealth();

    expect(health.postgres).toBe("ok");
    expect(health.redis).toBe("down");
    expect(health.status).toBe("ok");
  });

  it("reports degraded when postgres is down", async () => {
    const service = buildService({
      clientInfo: async () => "redis_version:7",
      pingPostgres: async () => {
        throw new Error("db down");
      },
    });

    const health = await service.getHealth();

    expect(health.postgres).toBe("down");
    expect(health.status).toBe("degraded");
  });
});

describe("HealthService.getReadiness", () => {
  it("reports ok when postgres and redis both respond", async () => {
    const service = buildService({
      clientInfo: async () => "redis_version:7",
      pingPostgres: async () => undefined,
    });

    const readiness = await service.getReadiness();

    expect(readiness.postgres).toBe("ok");
    expect(readiness.redis).toBe("ok");
    expect(readiness.status).toBe("ok");
    expect(typeof readiness.timestamp).toBe("string");
    expect(typeof readiness.uptimeSeconds).toBe("number");
  });

  it("reports degraded when redis is down even though postgres responds", async () => {
    const service = buildService({
      clientInfo: async () => {
        throw new Error("redis unreachable");
      },
      pingPostgres: async () => undefined,
    });

    const readiness = await service.getReadiness();

    expect(readiness.postgres).toBe("ok");
    expect(readiness.redis).toBe("down");
    expect(readiness.status).toBe("degraded");
  });

  it("reports degraded when postgres is down", async () => {
    const service = buildService({
      clientInfo: async () => "redis_version:7",
      pingPostgres: async () => {
        throw new Error("db down");
      },
    });

    const readiness = await service.getReadiness();

    expect(readiness.postgres).toBe("down");
    expect(readiness.status).toBe("degraded");
  });
});

describe("HealthService.getLiveness", () => {
  it("reports ok without probing dependencies", () => {
    const service = buildService({
      clientInfo: async () => {
        throw new Error("redis unreachable");
      },
      pingPostgres: async () => {
        throw new Error("db down");
      },
    });

    const liveness = service.getLiveness();

    expect(liveness.status).toBe("ok");
    expect(typeof liveness.timestamp).toBe("string");
    expect(typeof liveness.uptimeSeconds).toBe("number");
  });
});

import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../core/database/prisma.service.js";
import { createTestApp } from "../../test/create-test-app.js";
import { HEALTH_QUEUE_NAME } from "./health-queue.js";
import { HealthModule } from "./health.module.js";

let app: INestApplication;

const queueStub = { client: Promise.resolve({ info: async () => "redis_version:7.0.0" }) };

const unreachableQueueStub = {
  client: Promise.resolve({
    info: async () => {
      throw new Error("redis unreachable");
    },
  }),
};

const reachablePrismaStub = { ping: async () => undefined };

const unreachablePrismaStub = {
  ping: async () => {
    throw new Error("postgres unreachable");
  },
};

beforeAll(async () => {
  app = await createTestApp(
    [HealthModule],
    [{ provide: getQueueToken(HEALTH_QUEUE_NAME), useValue: queueStub }],
  );
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/health", () => {
  it("returns 200 with status ok and required fields", async () => {
    const res = await request(app.getHttpServer()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(["ok", "down"]).toContain(res.body.postgres);
    expect(res.body.redis).toBe("ok");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("includes x-request-id header", async () => {
    const res = await request(app.getHttpServer()).get("/api/health");

    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("propagates a valid incoming x-request-id", async () => {
    const incoming = "11111111-2222-4333-8444-555555555555";
    const res = await request(app.getHttpServer()).get("/api/health").set("x-request-id", incoming);

    expect(res.headers["x-request-id"]).toBe(incoming);
  });

  it("replaces a non-uuid incoming x-request-id with a generated one", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .set("x-request-id", "test-id-123");

    expect(res.headers["x-request-id"]).not.toBe("test-id-123");
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("GET /api/health/live", () => {
  let liveApp: INestApplication;

  beforeAll(async () => {
    liveApp = await createTestApp(
      [HealthModule],
      [
        { provide: getQueueToken(HEALTH_QUEUE_NAME), useValue: unreachableQueueStub },
        { provide: PrismaService, useValue: unreachablePrismaStub },
      ],
    );
  });

  afterAll(async () => {
    await liveApp.close();
  });

  it("returns 200 with status ok even when the dependencies are down", async () => {
    const res = await request(liveApp.getHttpServer()).get("/api/health/live");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

describe("GET /api/health/ready", () => {
  let degradedApp: INestApplication;
  let readyApp: INestApplication;

  beforeAll(async () => {
    degradedApp = await createTestApp(
      [HealthModule],
      [
        { provide: getQueueToken(HEALTH_QUEUE_NAME), useValue: unreachableQueueStub },
        { provide: PrismaService, useValue: reachablePrismaStub },
      ],
    );
    readyApp = await createTestApp(
      [HealthModule],
      [
        { provide: getQueueToken(HEALTH_QUEUE_NAME), useValue: queueStub },
        { provide: PrismaService, useValue: reachablePrismaStub },
      ],
    );
  });

  afterAll(async () => {
    await Promise.all([degradedApp.close(), readyApp.close()]);
  });

  it("returns 503 with status degraded when a dependency is down", async () => {
    const res = await request(degradedApp.getHttpServer()).get("/api/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.postgres).toBe("ok");
    expect(res.body.redis).toBe("down");
  });

  it("returns 200 with status ok when every dependency is up", async () => {
    const res = await request(readyApp.getHttpServer()).get("/api/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.postgres).toBe("ok");
    expect(res.body.redis).toBe("ok");
  });
});

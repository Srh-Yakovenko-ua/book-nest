import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp } from "../../test/create-test-app.js";
import { HEALTH_QUEUE_NAME } from "./health-queue.js";
import { HealthModule } from "./health.module.js";

let app: INestApplication;

const queueStub = { client: Promise.resolve({ info: async () => "redis_version:7.0.0" }) };

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

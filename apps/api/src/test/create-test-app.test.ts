import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HEALTH_QUEUE_NAME } from "../modules/health/health-queue.js";
import { HealthModule } from "../modules/health/health.module.js";
import { createTestApp } from "./create-test-app.js";

const REQUEST_COUNT = 5;

const queueStub = { client: Promise.resolve({ info: async () => "redis_version:7.0.0" }) };

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp(
    [HealthModule],
    [{ provide: getQueueToken(HEALTH_QUEUE_NAME), useValue: queueStub }],
  );
});

afterAll(async () => {
  await app.close();
});

describe("createTestApp", () => {
  it("keeps one ephemeral port for the lifetime of the app", async () => {
    const ports = new Set<string>();

    for (let index = 0; index < REQUEST_COUNT; index += 1) {
      const res = await request(app.getHttpServer()).get("/api/health");
      ports.add(new URL(res.request.url).port);
    }

    expect(ports.size).toBe(1);
  });
});

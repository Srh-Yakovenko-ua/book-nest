import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp } from "../../test/create-test-app.js";
import { MetricsModule } from "./metrics.module.js";

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp([MetricsModule]);
});

afterAll(async () => {
  await app.close();
});

describe("GET /api/metrics", () => {
  it("returns 200 with prometheus content-type", async () => {
    const res = await request(app.getHttpServer()).get("/api/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.headers["content-type"]).toContain("version=0.0.4");
  });

  it("exposes default node process metrics", async () => {
    const res = await request(app.getHttpServer()).get("/api/metrics");

    expect(res.text).toContain("process_cpu_user_seconds_total");
    expect(res.text).toContain("nodejs_heap_size_total_bytes");
    expect(res.text).toContain("nodejs_eventloop_lag_seconds");
  });

  it("exposes http request metric definitions", async () => {
    const res = await request(app.getHttpServer()).get("/api/metrics");

    expect(res.text).toContain("# TYPE http_requests_total counter");
    expect(res.text).toContain("# TYPE http_request_duration_seconds histogram");
    expect(res.text).toContain("# TYPE http_requests_in_flight gauge");
  });
});

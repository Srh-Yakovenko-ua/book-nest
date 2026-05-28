import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HealthModule } from "../../modules/health/health.module.js";
import { createTestApp } from "../../test/create-test-app.js";

let app: INestApplication;
let server: ReturnType<INestApplication["getHttpServer"]>;

beforeAll(async () => {
  app = await createTestApp([HealthModule]);
  server = app.getHttpServer();
});

afterAll(async () => {
  await app.close();
});

describe("HttpErrorFilter — body-parser errors", () => {
  it("returns 400 when JSON body is malformed", async () => {
    const res = await request(server)
      .post("/api/health")
      .set("content-type", "application/json")
      .send("not-json");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 413 when JSON body exceeds the size limit", async () => {
    const oversized = JSON.stringify({ blob: "x".repeat(1024 * 1024 + 100) });

    const res = await request(server)
      .post("/api/health")
      .set("content-type", "application/json")
      .send(oversized);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty("message");
  });
});

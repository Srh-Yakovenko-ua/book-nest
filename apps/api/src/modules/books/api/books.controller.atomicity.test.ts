import type { INestApplication } from "@nestjs/common";

import { BOOK_SERIES_PART_NUMBER_TAKEN_CODE } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
  app = context.app;
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function listLists(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/lists")
    .set("Authorization", `Bearer ${accessToken}`);
}

function listSeries(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/series")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("books create atomicity", () => {
  it("rolls back a newly created list when the part-number check fails after the sub-writes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const seed = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass", status: "ongoing" },
      partNumber: 1,
      title: "Throne of Glass",
    });
    expect(seed.status).toBe(201);
    const seriesId = seed.body.series.id;

    const listsBefore = await listLists(accessToken);
    const seriesBefore = await listSeries(accessToken);
    expect(listsBefore.body.totalCount).toBe(0);
    expect(seriesBefore.body.totalCount).toBe(1);

    const failed = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newLists: [{ name: "Orphaned On Rollback" }],
      partNumber: 1,
      seriesId,
      title: "Crown of Midnight",
    });
    expect(failed.status).toBe(400);
    expect(failed.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: BOOK_SERIES_PART_NUMBER_TAKEN_CODE, field: "partNumber" }),
      ]),
    );

    const listsAfter = await listLists(accessToken);
    const seriesAfter = await listSeries(accessToken);
    expect(listsAfter.body.totalCount).toBe(listsBefore.body.totalCount);
    expect(seriesAfter.body.totalCount).toBe(seriesBefore.body.totalCount);
  });
});

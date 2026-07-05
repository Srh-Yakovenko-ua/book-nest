import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

type SeriesParts = {
  bookIds: [string, string, string];
  seriesId: string;
};

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

async function createThreePartSeries(accessToken: string): Promise<SeriesParts> {
  const first = await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    newSeries: { name: "Throne of Glass", status: "ongoing" },
    partNumber: 1,
    title: "Throne of Glass",
  });
  const seriesId = first.body.series.id;

  const second = await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    partNumber: 2,
    seriesId,
    title: "Crown of Midnight",
  });
  const third = await createBook(accessToken, {
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    partNumber: 3,
    seriesId,
    title: "Heir of Fire",
  });

  return { bookIds: [first.body.id, second.body.id, third.body.id], seriesId };
}

function finishBook(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/reading-status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ status: "finished" });
}

function getBook(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function searchSeries(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/series")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("series preview through the books endpoints", () => {
  it("reports the first part as the series nextBook when nothing is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[0]);

    expect(res.status).toBe(200);
    expect(res.body.series.nextBook).toEqual({
      id: bookIds[0],
      partNumber: 1,
      title: "Throne of Glass",
    });
    expect(res.body.series.finishedInSeries).toBe(0);
  });

  it("does not flag the first part as having unread earlier parts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[0]);

    expect(res.body.hasUnreadEarlierSeriesParts).toBe(false);
  });

  it("flags a later part as having unread earlier parts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.hasUnreadEarlierSeriesParts).toBe(true);
  });

  it("advances nextBook and increments finishedInSeries after the first part is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    await finishBook(accessToken, bookIds[0]);
    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.nextBook).toEqual({
      id: bookIds[1],
      partNumber: 2,
      title: "Crown of Midnight",
    });
    expect(res.body.series.finishedInSeries).toBe(1);
  });

  it("clears the unread-earlier flag once every earlier part is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    await finishBook(accessToken, bookIds[0]);
    await finishBook(accessToken, bookIds[1]);
    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.hasUnreadEarlierSeriesParts).toBe(false);
    expect(res.body.series.nextBook).toEqual({
      id: bookIds[2],
      partNumber: 3,
      title: "Heir of Fire",
    });
  });

  it("clears nextBook once every part is finished", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    await finishBook(accessToken, bookIds[0]);
    await finishBook(accessToken, bookIds[1]);
    await finishBook(accessToken, bookIds[2]);
    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.nextBook).toBeNull();
    expect(res.body.series.finishedInSeries).toBe(3);
  });

  it("returns null series preview fields for a solo book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await getBook(accessToken, created.body.id);

    expect(res.body.series).toBeNull();
    expect(res.body.hasUnreadEarlierSeriesParts).toBeNull();
  });

  it("carries nextBook in the series search response", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds, seriesId } = await createThreePartSeries(accessToken);

    const res = await searchSeries(accessToken);

    const item = res.body.items.find((entry: { id: string }) => entry.id === seriesId);
    expect(item.nextBook).toEqual({ id: bookIds[0], partNumber: 1, title: "Throne of Glass" });
  });
});

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
  tagIds: { courtIntrigue: string; saga: string };
};

type TagRef = { id: string; name: string };

const SERIES_TAG_NAMES = { courtIntrigue: "court intrigue", saga: "saga" } as const;

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

async function createGappedSeries(accessToken: string): Promise<string> {
  const first = await createBook(accessToken, {
    authors: [{ name: "Leigh Bardugo" }],
    bookType: "series_part",
    newSeries: { name: "Grishaverse", status: "ongoing" },
    partNumber: 1,
    title: "Shadow and Bone",
  });
  await createBook(accessToken, {
    authors: [{ name: "Leigh Bardugo" }],
    bookType: "series_part",
    partNumber: 4,
    seriesId: first.body.series.id,
    title: "Six of Crows",
  });

  return first.body.id;
}

async function createThreePartSeries(accessToken: string): Promise<SeriesParts> {
  const first = await createBook(accessToken, {
    ageCategory: "12_plus",
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    formats: ["audiobook"],
    language: "german",
    newSeries: { name: "Throne of Glass", status: "ongoing" },
    ownershipStatus: "owned",
    pagesCount: 404,
    partNumber: 1,
    publicationYear: 2012,
    publisherName: "Bloomsbury",
    readingProgress: { rating: 7 },
    readingStatus: "paused",
    tags: [SERIES_TAG_NAMES.saga],
    title: "Throne of Glass",
  });
  const seriesId = first.body.series.id;

  const second = await createBook(accessToken, {
    ageCategory: "6_plus",
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    formats: ["ebook", "paper"],
    isFavorite: true,
    language: "polish",
    ownershipStatus: "want_to_buy",
    pagesCount: 418,
    partNumber: 2,
    readingProgress: { rating: 10 },
    readingStatus: "paused",
    seriesId,
    tags: [SERIES_TAG_NAMES.saga, SERIES_TAG_NAMES.courtIntrigue],
    title: "Crown of Midnight",
  });
  const third = await createBook(accessToken, {
    ageCategory: "16_plus",
    authors: [{ name: "Sarah J. Maas" }],
    bookType: "series_part",
    formats: ["paper"],
    language: "english",
    ownershipStatus: "in_transit",
    partNumber: 3,
    seriesId,
    title: "Heir of Fire",
  });

  const secondTags: TagRef[] = second.body.tags;
  const tagIdByName = new Map(secondTags.map((tag) => [tag.name, tag.id]));

  return {
    bookIds: [first.body.id, second.body.id, third.body.id],
    seriesId,
    tagIds: {
      courtIntrigue: tagIdByName.get(SERIES_TAG_NAMES.courtIntrigue) ?? "",
      saga: tagIdByName.get(SERIES_TAG_NAMES.saga) ?? "",
    },
  };
}

function deleteBook(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
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
      cover: null,
      id: bookIds[0],
      ownershipStatus: "owned",
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
      cover: null,
      id: bookIds[1],
      ownershipStatus: "want_to_buy",
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
      cover: null,
      id: bookIds[2],
      ownershipStatus: "in_transit",
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
    expect(item.nextBook).toEqual({
      cover: null,
      id: bookIds[0],
      ownershipStatus: "owned",
      partNumber: 1,
      title: "Throne of Glass",
    });
  });
});

describe("series attention fields through GET /api/books/:id", () => {
  it("flags the series as having a publisher carried by a sibling part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.hasPublisher).toBe(true);
  });

  it("flags the series as having a publication year carried by a sibling part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.hasPublicationYears).toBe(true);
  });

  it("reports no missing part numbers when every part between the first and the last exists", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[0]);

    expect(res.body.series.missingPartNumbers).toEqual([]);
  });

  it("reports the interior part numbers missing from the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createGappedSeries(accessToken);

    const res = await getBook(accessToken, bookId);

    expect(res.body.series.missingPartNumbers).toEqual([2, 3]);
  });

  it("reports both attention flags as false when no part carries either value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createGappedSeries(accessToken);

    const res = await getBook(accessToken, bookId);

    expect(res.body.series).toMatchObject({
      hasPublicationYears: false,
      hasPublisher: false,
    });
  });
});

describe("series book aggregates through GET /api/books/:id", () => {
  it("averages the ratings carried by the sibling parts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.status).toBe(200);
    expect(res.body.series.averageRating).toBe(8.5);
  });

  it("counts the owned parts against every active part of the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.ownership).toEqual({ ownedCount: 1, total: 3 });
  });

  it("returns the deduplicated formats of the sibling parts in the declared enum order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.formats).toEqual(["paper", "ebook", "audiobook"]);
  });

  it("returns the deduplicated languages of the sibling parts in the declared enum order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.languages).toEqual(["english", "polish", "german"]);
  });

  it("returns the deduplicated age categories of the sibling parts in the declared enum order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.ageCategories).toEqual(["6_plus", "12_plus", "16_plus"]);
  });

  it("returns the deduplicated tags of the sibling parts sorted by name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds, tagIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.tags).toEqual([
      { id: tagIds.courtIntrigue, name: SERIES_TAG_NAMES.courtIntrigue },
      { id: tagIds.saga, name: SERIES_TAG_NAMES.saga },
    ]);
  });

  it("sums and averages the page counts carried by the sibling parts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series).toMatchObject({ averagePages: 411, pagesCount: 822 });
  });

  it("flags the series as holding a favorite sibling part", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const res = await getBook(accessToken, bookIds[2]);

    expect(res.body.series.hasFavoriteBook).toBe(true);
  });
});

describe("series fields after a middle part is moved to the trash", () => {
  it("excludes the trashed part from the series fields on GET /api/books/:id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds } = await createThreePartSeries(accessToken);

    const trashed = await deleteBook(accessToken, bookIds[1]);
    const res = await getBook(accessToken, bookIds[2]);

    expect(trashed.status).toBe(200);
    expect(res.body.series).toMatchObject({
      missingPartNumbers: [2],
      ownership: { ownedCount: 1, total: 2 },
    });
  });

  it("excludes the trashed part from the series fields on GET /api/series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookIds, seriesId } = await createThreePartSeries(accessToken);

    const trashed = await deleteBook(accessToken, bookIds[1]);
    const res = await searchSeries(accessToken);

    expect(trashed.status).toBe(200);
    const item = res.body.items.find((entry: { id: string }) => entry.id === seriesId);
    expect(item).toMatchObject({
      missingPartNumbers: [2],
      ownership: { ownedCount: 1, total: 2 },
    });
  });
});

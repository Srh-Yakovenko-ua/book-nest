import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { OpenLibraryAuthorDetail } from "../../authors/infrastructure/open-library.client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { OpenLibraryClient } from "../../authors/infrastructure/open-library.client.js";
import { WikidataClient } from "../../authors/infrastructure/wikidata.client.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OPEN_LIBRARY_KEY = "OL23919A";

const authorDetail: OpenLibraryAuthorDetail = {
  bio: "An English novelist.",
  birthYear: 1903,
  name: "George Orwell",
  photoUrl: "https://covers.openlibrary.org/a/id/12345-L.jpg",
  wikidataId: "Q3335",
};

const getAuthorByKey = vi.fn<(olid: string) => Promise<null | OpenLibraryAuthorDetail>>();
const getAuthorFactsByQid = vi.fn().mockResolvedValue(null);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, ListsModule],
    [
      { provide: OpenLibraryClient, useValue: { getAuthorByKey } },
      { provide: WikidataClient, useValue: { getAuthorFactsByQid } },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  getAuthorByKey.mockReset();
  getAuthorByKey.mockResolvedValue(authorDetail);
  getAuthorFactsByQid.mockReset();
  getAuthorFactsByQid.mockResolvedValue(null);
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

describe("POST /api/books author reference dispatch", () => {
  it("creates a custom author when the reference is a name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.authors[0].name).toBe("Frank Herbert");
    const author = await prisma.author.findFirst({ where: { name: "Frank Herbert" } });
    expect(author?.userId).toBe(userId);
  });

  it("references a seeded global author when the reference is its id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const global = await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });

    const res = await createBook(accessToken, {
      authors: [{ id: global.id }],
      title: "1984",
    });

    expect(res.status).toBe(201);
    expect(res.body.authors[0]).toEqual({ id: global.id, name: "George Orwell" });
  });

  it("returns 404 when the id references another user's custom author", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await prisma.author.create({
      data: { name: "Owner Author", normalizedName: "owner author", userId: owner.userId },
    });

    const res = await createBook(stranger.accessToken, {
      authors: [{ id: ownerAuthor.id }],
      title: "Dune",
    });

    expect(res.status).toBe(404);
  });

  it("materializes a global author from open library when the reference is a key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "1984",
    });

    expect(res.status).toBe(201);
    expect(res.body.authors[0].id).toMatch(UUID);
    expect(res.body.authors[0].name).toBe("George Orwell");
    const materialized = await prisma.author.findFirst({
      where: { openLibraryKey: OPEN_LIBRARY_KEY },
    });
    expect(materialized?.userId).toBeNull();
    expect(materialized?.countryCode).toBeNull();
  });

  it("reuses the same materialized author when two books reference the same open library key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const first = await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "1984",
    });
    const second = await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "Animal Farm",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.authors[0].id).toBe(first.body.authors[0].id);
    const authors = await prisma.author.findMany({ where: { openLibraryKey: OPEN_LIBRARY_KEY } });
    expect(authors).toHaveLength(1);
  });

  it("fetches open library only once across a deduped second materialization", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "1984",
    });
    await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "Animal Farm",
    });

    expect(getAuthorByKey).toHaveBeenCalledTimes(1);
  });

  it("enriches a materialized author with wikidata country and death year", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    getAuthorFactsByQid.mockResolvedValueOnce({
      birthYear: 1903,
      countryCode: "GB",
      deathYear: 1950,
    });

    await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "1984",
    });

    const materialized = await prisma.author.findFirst({
      where: { openLibraryKey: OPEN_LIBRARY_KEY },
    });
    expect(materialized?.countryCode).toBe("GB");
    expect(materialized?.deathYear).toBe(1950);
  });

  it("returns 502 when open library cannot resolve the author key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    getAuthorByKey.mockResolvedValue(null);

    const res = await createBook(accessToken, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
      title: "1984",
    });

    expect(res.status).toBe(502);
  });

  it("returns 400 when the author reference is an empty object", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, { authors: [{}], title: "Dune" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the open library key is malformed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ openLibraryKey: "not-a-key" }],
      title: "Dune",
    });

    expect(res.status).toBe(400);
  });
});

import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
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

function createAuthor(userId: string, name: string): Promise<{ id: string; name: string }> {
  return prisma.author.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
    select: { id: true, name: true },
  });
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function linkedAuthorIds(seriesId: string): Promise<string[]> {
  const rows = await prisma.seriesAuthor.findMany({ where: { seriesId } });
  return rows.map((row) => row.authorId);
}

function searchSeries(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/series")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("POST /api/books series author linking", () => {
  it("seeds the explicit newSeries authors while the series view derives authors from its book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    const authorB = await createAuthor(userId, "Author B");

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: {
        authors: [{ id: authorA.id }, { id: authorB.id }],
        name: "Throne of Glass",
        status: "ongoing",
      },
      partNumber: 1,
      title: "Throne of Glass",
    });

    expect(res.status).toBe(201);
    const seriesId = res.body.series.id;
    expect((await linkedAuthorIds(seriesId)).sort()).toEqual([authorA.id, authorB.id].sort());

    const search = await searchSeries(accessToken);
    const item = search.body.items.find((entry: { id: string }) => entry.id === seriesId);
    expect(item.authors.map((author: { name: string }) => author.name)).toEqual(["Sarah J. Maas"]);
  });

  it("inherits the book's resolved authors when newSeries omits an authors field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Ann Author" }, { name: "Bob Writer" }],
      bookType: "series_part",
      newSeries: { name: "Inherited Series", status: "unknown" },
      partNumber: 1,
      title: "Book One",
    });

    expect(res.status).toBe(201);
    const seriesId = res.body.series.id;
    const bookAuthorIds = res.body.authors.map((author: { id: string }) => author.id);

    expect((await linkedAuthorIds(seriesId)).sort()).toEqual([...bookAuthorIds].sort());

    const search = await searchSeries(accessToken);
    const item = search.body.items.find((entry: { id: string }) => entry.id === seriesId);
    expect(item.authors.map((author: { name: string }) => author.name).sort()).toEqual([
      "Ann Author",
      "Bob Writer",
    ]);
  });

  it("seeds the explicit newSeries authors, not the book's, into the link table", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesAuthor = await createAuthor(userId, "Series Author");

    const res = await createBook(accessToken, {
      authors: [{ name: "Book Author" }],
      bookType: "series_part",
      newSeries: { authors: [{ id: seriesAuthor.id }], name: "Distinct Series", status: "unknown" },
      partNumber: 1,
      title: "Book One",
    });

    expect(res.status).toBe(201);
    const seriesId = res.body.series.id;
    const bookAuthorId = res.body.authors[0].id;

    const linked = await linkedAuthorIds(seriesId);
    expect(linked).toEqual([seriesAuthor.id]);
    expect(linked).not.toContain(bookAuthorId);
  });

  it("does not change an existing series' authors when a book links to it by id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const originalAuthor = await createAuthor(userId, "Original Author");
    const existing = await prisma.series.create({
      data: {
        authors: { create: [{ authorId: originalAuthor.id }] },
        name: "Existing Series",
        normalizedName: "existing series",
        userId,
      },
      select: { id: true },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Different Book Author" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId: existing.id,
      title: "Linked Book",
    });

    expect(res.status).toBe(201);
    expect(await linkedAuthorIds(existing.id)).toEqual([originalAuthor.id]);
  });
});

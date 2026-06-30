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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

function authorNames(body: { authors: { name: string }[] }): string[] {
  return body.authors.map((author) => author.name);
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function listAuthorAsc(accessToken: string): Promise<string[]> {
  const res = await request(app.getHttpServer())
    .get("/api/books?sort=author_asc")
    .set("Authorization", `Bearer ${accessToken}`);
  return res.body.items.map((item: { title: string }) => item.title);
}

function updateBook(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("POST /api/books multiple authors", () => {
  it("creates a book with three authors and preserves their input order", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Terry Pratchett" }, { name: "Neil Gaiman" }, { name: "Stephen King" }],
      title: "Good Omens",
    });

    expect(res.status).toBe(201);
    expect(authorNames(res.body)).toEqual(["Terry Pratchett", "Neil Gaiman", "Stephen King"]);
    for (const author of res.body.authors) {
      expect(author.id).toMatch(UUID);
    }
  });

  it("persists the authors as join rows ordered by position", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Terry Pratchett" }, { name: "Neil Gaiman" }],
      title: "Good Omens",
    });

    const joinRows = await prisma.bookAuthor.findMany({
      orderBy: { position: "asc" },
      where: { bookId: res.body.id },
    });
    expect(joinRows.map((row) => row.position)).toEqual([0, 1]);
    expect(joinRows[0]?.authorId).toBe(res.body.authors[0].id);
    expect(joinRows[1]?.authorId).toBe(res.body.authors[1].id);
  });

  it("de-duplicates references that resolve to the same author keeping first occurrence", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [
        { name: "Terry Pratchett" },
        { name: "Neil Gaiman" },
        { name: "  terry   pratchett " },
      ],
      title: "Good Omens",
    });

    expect(res.status).toBe(201);
    expect(authorNames(res.body)).toEqual(["Terry Pratchett", "Neil Gaiman"]);
    const rows = await prisma.author.findMany({ where: { userId } });
    expect(rows).toHaveLength(2);
  });

  it("returns 400 when the authors array is empty", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, { authors: [], title: "Dune" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "authors" })]),
    );
  });

  it("returns 400 when more than twenty authors are provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const authors = Array.from({ length: 21 }, (unused, index) => ({ name: `Author ${index}` }));

    const res = await createBook(accessToken, { authors, title: "Crowded" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "authors" })]),
    );
  });

  it("resolves a mix of an existing global author id and a new custom name in order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const global = await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });

    const res = await createBook(accessToken, {
      authors: [{ id: global.id }, { name: "Frank Herbert" }],
      title: "An Unlikely Collaboration",
    });

    expect(res.status).toBe(201);
    expect(res.body.authors[0]).toEqual({ id: global.id, name: "George Orwell" });
    expect(res.body.authors[1].name).toBe("Frank Herbert");
    const custom = await prisma.author.findFirst({ where: { name: "Frank Herbert", userId } });
    expect(res.body.authors[1].id).toBe(custom?.id);
  });
});

describe("PATCH /api/books/:id multiple authors", () => {
  it("replaces the author set and recomputes the author sort key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const anchor = await createBook(accessToken, {
      authors: [{ name: "Mercedes Lackey" }],
      title: "Anchor",
    });
    const target = await createBook(accessToken, {
      authors: [{ name: "Douglas Adams" }, { name: "Iain Banks" }],
      title: "Target",
    });

    expect(anchor.status).toBe(201);
    expect(target.status).toBe(201);
    expect(await listAuthorAsc(accessToken)).toEqual(["Target", "Anchor"]);

    const updated = await updateBook(accessToken, target.body.id, {
      authors: [{ name: "Zelazny Roger" }],
    });

    expect(updated.status).toBe(200);
    expect(authorNames(updated.body)).toEqual(["Zelazny Roger"]);
    const joinRows = await prisma.bookAuthor.findMany({ where: { bookId: target.body.id } });
    expect(joinRows).toHaveLength(1);
    expect(await listAuthorAsc(accessToken)).toEqual(["Anchor", "Target"]);
  });
});

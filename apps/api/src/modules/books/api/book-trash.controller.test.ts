import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_ID = "99999999-9999-4999-8999-999999999999";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule]);
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

function authed(
  method: "delete" | "get" | "patch" | "post",
  path: string,
  token: string,
): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

describe("DELETE /api/books/:id", () => {
  it("moves the book to the trash and reports when it will be purged", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await authed("delete", `/api/books/${bookId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.bookId).toBe(bookId);
    const deletedAt = new Date(res.body.deletedAt);
    expect(new Date(res.body.purgeAt)).toEqual(TRASH_RETENTION.stamp(deletedAt).purgeAt);

    const row = await prisma.book.findUniqueOrThrow({
      select: { deletedAt: true },
      where: { id: bookId },
    });
    expect(row.deletedAt).not.toBeNull();
  });

  it("hides the trashed book from the library, its details and the overview counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const keptId = await createBook(accessToken, { title: "Kept" });
    const trashedId = await createBook(accessToken, { title: "Trashed" });

    await authed("delete", `/api/books/${trashedId}`, accessToken).expect(HttpStatus.OK);

    const details = await authed("get", `/api/books/${trashedId}`, accessToken);
    expect(details.status).toBe(HttpStatus.NOT_FOUND);

    const library = await authed("get", "/api/books", accessToken);
    expect(library.body.totalCount).toBe(1);
    expect(library.body.items.map((book: { id: string }) => book.id)).toEqual([keptId]);

    const overview = await authed("get", "/api/books/overview", accessToken);
    expect(overview.body.summary.total).toBe(1);
    expect(overview.body.recentlyAdded.map((book: { id: string }) => book.id)).toEqual([keptId]);
  });

  it("returns 404 when the book is already in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("delete", `/api/books/${bookId}`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    await authed("delete", `/api/books/${bookId}`, stranger.accessToken).expect(
      HttpStatus.NOT_FOUND,
    );

    const row = await prisma.book.findUniqueOrThrow({
      select: { deletedAt: true },
      where: { id: bookId },
    });
    expect(row.deletedAt).toBeNull();
  });

  it("frees the series slot so the same part number can be used again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstId = await createBook(accessToken, {
      bookType: "series_part",
      newSeries: { name: "Dune Chronicles" },
      partNumber: 1,
    });
    const seriesId = (
      await prisma.book.findUniqueOrThrow({ select: { seriesId: true }, where: { id: firstId } })
    ).seriesId;

    await authed("delete", `/api/books/${firstId}`, accessToken).expect(HttpStatus.OK);

    const replacement = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "Frank Herbert" }],
      bookType: "series_part",
      ownershipStatus: "owned",
      partNumber: 1,
      seriesId,
      title: "Dune reissue",
    });

    expect(replacement.status).toBe(HttpStatus.CREATED);
  });
});

describe("GET /api/books/trash", () => {
  it("lists trashed books newest first with their purge date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstId = await createBook(accessToken, { title: "First" });
    const secondId = await createBook(accessToken, { title: "Second" });

    await authed("delete", `/api/books/${firstId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/books/${secondId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("get", "/api/books/trash", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.items.map((book: { id: string }) => book.id)).toEqual([secondId, firstId]);
    expect(res.body.items[0]).toMatchObject({
      authors: [{ name: "Frank Herbert" }],
      title: "Second",
    });
    expect(new Date(res.body.items[0].purgeAt)).toEqual(
      TRASH_RETENTION.stamp(new Date(res.body.items[0].deletedAt)).purgeAt,
    );
  });

  it("never leaks another user trash", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await authed("delete", `/api/books/${bookId}`, owner.accessToken).expect(HttpStatus.OK);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", "/api/books/trash", stranger.accessToken);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it("keeps active books out of the trash listing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBook(accessToken);

    const res = await authed("get", "/api/books/trash", accessToken);

    expect(res.body.totalCount).toBe(0);
  });
});

describe("POST /api/books/:id/restore", () => {
  it("brings the book back into the library with its state intact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, { isFavorite: true, title: "Dune" });

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    const res = await authed("post", `/api/books/${bookId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toMatchObject({ id: bookId, isFavorite: true, title: "Dune" });

    const library = await authed("get", "/api/books", accessToken);
    expect(library.body.items.map((book: { id: string }) => book.id)).toEqual([bookId]);

    const trash = await authed("get", "/api/books/trash", accessToken);
    expect(trash.body.totalCount).toBe(0);
  });

  it("returns 404 for a book that is not in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);

    const res = await authed("post", `/api/books/${bookId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 for a missing book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("post", `/api/books/${MISSING_ID}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("returns 404 when another user tries to restore the book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    await authed("delete", `/api/books/${bookId}`, owner.accessToken).expect(HttpStatus.OK);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("post", `/api/books/${bookId}/restore`, stranger.accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("POST /api/books/bulk/delete", () => {
  it("moves every owned book to the trash instead of erasing it", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstId = await createBook(accessToken, { title: "First" });
    const secondId = await createBook(accessToken, { title: "Second" });

    const res = await authed("post", "/api/books/bulk/delete", accessToken).send({
      bookIds: [firstId, secondId],
    });

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ affected: 2 });

    const trash = await authed("get", "/api/books/trash", accessToken);
    expect(trash.body.totalCount).toBe(2);

    const rows = await prisma.book.findMany({ select: { id: true } });
    expect(rows).toHaveLength(2);
  });
});

describe("restoring into a slot that was taken while the row sat in the trash", () => {
  it("returns 409 instead of failing on the partial unique index", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstId = await createBook(accessToken, {
      bookType: "series_part",
      newSeries: { name: "Contested" },
      partNumber: 1,
    });
    const seriesId = (
      await prisma.book.findUniqueOrThrow({ select: { seriesId: true }, where: { id: firstId } })
    ).seriesId;

    await authed("delete", `/api/books/${firstId}`, accessToken).expect(HttpStatus.OK);
    await authed("post", "/api/books", accessToken)
      .send({
        authors: [{ name: "Frank Herbert" }],
        bookType: "series_part",
        ownershipStatus: "owned",
        partNumber: 1,
        seriesId,
        title: "Took the slot",
      })
      .expect(HttpStatus.CREATED);

    const res = await authed("post", `/api/books/${firstId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CONFLICT);

    const stillTrashed = await authed("get", "/api/books/trash", accessToken);
    expect(stillTrashed.body.totalCount).toBe(1);
  });

  it("restores once the slot is freed again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstId = await createBook(accessToken, {
      bookType: "series_part",
      newSeries: { name: "Freed" },
      partNumber: 1,
    });
    const seriesId = (
      await prisma.book.findUniqueOrThrow({ select: { seriesId: true }, where: { id: firstId } })
    ).seriesId;

    await authed("delete", `/api/books/${firstId}`, accessToken).expect(HttpStatus.OK);
    const replacement = await authed("post", "/api/books", accessToken).send({
      authors: [{ name: "Frank Herbert" }],
      bookType: "series_part",
      ownershipStatus: "owned",
      partNumber: 1,
      seriesId,
      title: "Temporary",
    });
    await authed("patch", `/api/books/${replacement.body.id}`, accessToken)
      .send({ partNumber: 2 })
      .expect(HttpStatus.OK);

    const res = await authed("post", `/api/books/${firstId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toMatchObject({ id: firstId, partNumber: 1 });
  });
});

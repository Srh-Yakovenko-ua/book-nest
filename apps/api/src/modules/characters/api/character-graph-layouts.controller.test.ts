import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = "99999999-9999-4999-8999-999999999999";
const CHARACTER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHARACTER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const LAYOUTS_PATH = "/api/character-graph-layouts";

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
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

function authed(method: "delete" | "get" | "put", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createOwnedBook(token: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${token}`)
    .send({
      authors: [{ name: "George R. R. Martin" }],
      ownershipStatus: "owned",
      title: "A Game of Thrones",
    });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createOwnedSeries(token: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${token}`)
    .send({
      authors: [{ name: "George R. R. Martin" }],
      bookType: "series_part",
      newSeries: { name: "A Song of Ice and Fire" },
      ownershipStatus: "owned",
      partNumber: 1,
      title: "A Game of Thrones",
    });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.series.id;
}

const GLOBAL_ALL_QUERY = "scopeType=global&mode=all";

function globalLayoutBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    layoutVersion: "graph-v1",
    mode: "all",
    positions: {
      [CHARACTER_A]: { x: 10.5, y: -20 },
      [CHARACTER_B]: { x: 30, y: 40 },
    },
    scopeType: "global",
    viewport: { x: 5, y: 6, zoom: 1.5 },
    ...overrides,
  };
}

describe("character graph layout save and read", () => {
  it("creates then replaces a global layout as a single row (advisory-lock uniqueness)", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const created = await authed("put", LAYOUTS_PATH, accessToken).send(globalLayoutBody());
    expect(created.status).toBe(HttpStatus.OK);
    expect(created.body.id).toMatch(UUID);
    expect(created.body.layoutVersion).toBe("graph-v1");

    const replaced = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ layoutVersion: "graph-v2", viewport: null }),
    );
    expect(replaced.status).toBe(HttpStatus.OK);
    expect(replaced.body.id).toBe(created.body.id);
    expect(replaced.body.layoutVersion).toBe("graph-v2");
    expect(replaced.body.viewport).toBeNull();

    const prisma = app.get(PrismaService);
    expect(await prisma.characterGraphLayout.count({ where: { userId } })).toBe(1);
  });

  it("returns the exact-key layout and re-parses stored JSON on read", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await authed("put", LAYOUTS_PATH, accessToken).send(globalLayoutBody());

    const read = await authed("get", `${LAYOUTS_PATH}?${GLOBAL_ALL_QUERY}`, accessToken);
    expect(read.status).toBe(HttpStatus.OK);
    expect(read.body).toMatchObject({
      layoutVersion: "graph-v1",
      mode: "all",
      scopeId: null,
      scopeType: "global",
    });
    expect(read.body.positions).toEqual({
      [CHARACTER_A]: { x: 10.5, y: -20 },
      [CHARACTER_B]: { x: 30, y: 40 },
    });
    expect(read.body.viewport).toEqual({ x: 5, y: 6, zoom: 1.5 });
  });

  it("distinguishes layouts by mode and reading context", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await authed("put", LAYOUTS_PATH, accessToken).send(globalLayoutBody({ layoutVersion: "all" }));
    await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ layoutVersion: "family", mode: "family" }),
    );

    const all = await authed("get", `${LAYOUTS_PATH}?scopeType=global&mode=all`, accessToken);
    expect(all.body.layoutVersion).toBe("all");

    const family = await authed("get", `${LAYOUTS_PATH}?scopeType=global&mode=family`, accessToken);
    expect(family.body.layoutVersion).toBe("family");
  });

  it("returns 404 when no layout matches the key", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const read = await authed("get", `${LAYOUTS_PATH}?${GLOBAL_ALL_QUERY}`, accessToken);
    expect(read.status).toBe(HttpStatus.NOT_FOUND);
    expect(read.body.code).toBe("character_graph_layout_not_found");
  });

  it("saves a book-scoped layout for an owned book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createOwnedBook(accessToken);

    const saved = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ contextBookId: bookId, scopeId: bookId, scopeType: "book" }),
    );
    expect(saved.status).toBe(HttpStatus.OK);
    expect(saved.body.scopeId).toBe(bookId);
    expect(saved.body.contextBookId).toBe(bookId);

    const read = await authed(
      "get",
      `${LAYOUTS_PATH}?scopeType=book&scopeId=${bookId}&mode=all&contextBookId=${bookId}`,
      accessToken,
    );
    expect(read.status).toBe(HttpStatus.OK);
    expect(read.body.scopeId).toBe(bookId);
  });

  it("saves a series-scoped layout for an owned series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const seriesId = await createOwnedSeries(accessToken);

    const saved = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ scopeId: seriesId, scopeType: "series" }),
    );
    expect(saved.status).toBe(HttpStatus.OK);
    expect(saved.body.scopeType).toBe("series");
    expect(saved.body.scopeId).toBe(seriesId);
  });
});

describe("character graph layout delete", () => {
  it("deletes a layout then 404s on re-read and re-delete", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await authed("put", LAYOUTS_PATH, accessToken).send(globalLayoutBody());

    const removed = await authed("delete", `${LAYOUTS_PATH}?${GLOBAL_ALL_QUERY}`, accessToken);
    expect(removed.status).toBe(HttpStatus.NO_CONTENT);

    const prisma = app.get(PrismaService);
    expect(await prisma.characterGraphLayout.count({ where: { userId } })).toBe(0);

    const read = await authed("get", `${LAYOUTS_PATH}?${GLOBAL_ALL_QUERY}`, accessToken);
    expect(read.status).toBe(HttpStatus.NOT_FOUND);

    const removeAgain = await authed("delete", `${LAYOUTS_PATH}?${GLOBAL_ALL_QUERY}`, accessToken);
    expect(removeAgain.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("character graph layout ownership (IDOR)", () => {
  it("returns 404 for a foreign or missing scope book, series and context book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const foreignBook = await createOwnedBook(intruder.accessToken);
    const foreignSeries = await createOwnedSeries(intruder.accessToken);

    const foreignScopeBook = await authed("put", LAYOUTS_PATH, owner.accessToken).send(
      globalLayoutBody({ scopeId: foreignBook, scopeType: "book" }),
    );
    expect(foreignScopeBook.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignScopeBook.body.code).toBe("character_graph_layout_book_not_found");

    const foreignScopeSeries = await authed("put", LAYOUTS_PATH, owner.accessToken).send(
      globalLayoutBody({ scopeId: foreignSeries, scopeType: "series" }),
    );
    expect(foreignScopeSeries.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignScopeSeries.body.code).toBe("character_graph_layout_series_not_found");

    const foreignContext = await authed("put", LAYOUTS_PATH, owner.accessToken).send(
      globalLayoutBody({ contextBookId: MISSING_ID }),
    );
    expect(foreignContext.status).toBe(HttpStatus.NOT_FOUND);
    expect(foreignContext.body.code).toBe("character_graph_layout_book_not_found");
  });
});

describe("character graph layout validation", () => {
  it("rejects a scopeId for the global scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ scopeId: MISSING_ID }),
    );
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("requires a scopeId for the book and series scopes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const book = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ scopeType: "book" }),
    );
    expect(book.status).toBe(HttpStatus.BAD_REQUEST);

    const series = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ scopeType: "series" }),
    );
    expect(series.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("rejects positions with a non-uuid key or a non-numeric coordinate", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const badKey = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ positions: { "not-a-uuid": { x: 1, y: 2 } } }),
    );
    expect(badKey.status).toBe(HttpStatus.BAD_REQUEST);

    const badCoordinate = await authed("put", LAYOUTS_PATH, accessToken).send(
      globalLayoutBody({ positions: { [CHARACTER_A]: { x: "nope", y: 2 } } }),
    );
    expect(badCoordinate.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app.getHttpServer())
      .get(`${LAYOUTS_PATH}?${GLOBAL_ALL_QUERY}`)
      .send();
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

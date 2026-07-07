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
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
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

function readQueuePositions(
  userId: string,
): Promise<{ id: string; queuePosition: null | number }[]> {
  return prisma.book.findMany({
    orderBy: { queuePosition: "asc" },
    select: { id: true, queuePosition: true },
    where: { queuePosition: { not: null }, userId },
  });
}

function updateBook(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("PATCH /api/books/:id authorization and input", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/books/${MISSING_UUID}`)
      .send({ title: "New" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed id that is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await updateBook(accessToken, "not-a-uuid", { title: "New" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when updating a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await updateBook(stranger.accessToken, created.body.id, { title: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-existent book without leaking existence", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await updateBook(accessToken, MISSING_UUID, { title: "New" });

    expect(res.status).toBe(404);
  });

  it("returns 200 and leaves the book unchanged for an empty body", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {});

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune");
  });
});

describe("PATCH /api/books/:id scalar fields", () => {
  it("updates only the title and leaves the other scalars untouched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      description: "A desert epic",
      pagesCount: 412,
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune Reborn");
    expect(res.body.description).toBe("A desert epic");
    expect(res.body.pagesCount).toBe(412);
  });

  it("clears a nullable field when an explicit null is sent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { dedication: null });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBeNull();
  });

  it("leaves an absent nullable field as-is", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      dedication: "For my family",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.dedication).toBe("For my family");
  });

  it("toggles the favorite flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { isFavorite: true });

    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
  });
});

describe("PATCH /api/books/:id status to block transitions", () => {
  it("creates a reading-progress row when the status moves to reading", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "not_started",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { currentPage: 80, startedAt: "2026-02-01" },
      readingStatus: "reading",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toMatchObject({ currentPage: 80, startedAt: "2026-02-01" });
    const rows = await prisma.bookReadingProgress.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("keeps a finished reading-progress row with rating and impression", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { finishedAt: "2026-02-05", impression: "loved it", rating: 5 },
      readingStatus: "finished",
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toMatchObject({
      finishedAt: "2026-02-05",
      impression: "loved it",
      rating: 5,
    });
  });

  it("deletes the reading-progress row when the status moves back to not_started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 80 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { readingStatus: "not_started" });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toBeNull();
    const rows = await prisma.bookReadingProgress.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(0);
  });

  it("deletes the loan row when ownership moves away from borrowed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { ownershipStatus: "owned" });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toBeNull();
    const rows = await prisma.bookLoanInfo.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(0);
  });

  it("creates a purchase row when ownership moves to want_to_buy", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
    });

    expect(res.status).toBe(200);
    expect(res.body.purchaseInfo).toMatchObject({
      currency: "UAH",
      expectedPrice: 299.99,
      storeName: "Yakaboo",
    });
    const rows = await prisma.bookPurchaseInfo.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("swaps a delivery block for a loan block when ownership moves from in_transit to lent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      loanInfo: { personName: "Olha" },
      ownershipStatus: "lent_to_someone",
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toBeNull();
    expect(res.body.loanInfo).toMatchObject({ personName: "Olha" });
    const delivery = await prisma.bookDelivery.findMany({ where: { bookId: created.body.id } });
    const loan = await prisma.bookLoanInfo.findMany({ where: { bookId: created.body.id } });
    expect(delivery).toHaveLength(1);
    expect(delivery[0]?.status).toBe("cancelled");
    expect(loan).toHaveLength(1);
  });

  it("edits the active delivery row through the deliveryInfo block", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { deliveryStatus: "in_transit", storeName: "Nova Poshta" },
    });

    expect(res.status).toBe(200);
    expect(res.body.delivery.active).toMatchObject({
      status: "in_transit",
      storeName: "Nova Poshta",
    });
    expect(res.body.delivery.totalCount).toBe(1);
    const rows = await prisma.bookDelivery.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("creates an active delivery row when ownership moves to in_transit without one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      deliveryInfo: { storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("in_transit");
    expect(res.body.delivery.active).toMatchObject({ status: "ordered", storeName: "Yakaboo" });
    expect(res.body.delivery.totalCount).toBe(1);
    const rows = await prisma.bookDelivery.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });
});

describe("PATCH /api/books/:id relation re-resolution", () => {
  it("repoints the book to a new custom author resolved by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      authors: [{ name: "Ursula K. Le Guin" }],
    });

    expect(res.status).toBe(200);
    expect(res.body.authors[0].name).toBe("Ursula K. Le Guin");
    expect(res.body.authors[0].id).toMatch(UUID);
    const author = await prisma.author.findFirst({
      where: { name: "Ursula K. Le Guin", userId },
    });
    expect(author).not.toBeNull();
  });

  it("repoints the book to a seeded global author referenced by id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const global = await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });

    const res = await updateBook(accessToken, created.body.id, { authors: [{ id: global.id }] });

    expect(res.status).toBe(200);
    expect(res.body.authors[0]).toEqual({ id: global.id, name: "George Orwell" });
  });

  it("materializes a global author from open library and repoints the book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      authors: [{ openLibraryKey: OPEN_LIBRARY_KEY }],
    });

    expect(res.status).toBe(200);
    expect(res.body.authors[0].name).toBe("George Orwell");
    const materialized = await prisma.author.findFirst({
      where: { openLibraryKey: OPEN_LIBRARY_KEY },
    });
    expect(materialized?.userId).toBeNull();
  });

  it("returns 404 when repointing to another user's custom author", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const created = await createBook(stranger.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const ownerAuthor = await prisma.author.create({
      data: { name: "Owner Author", normalizedName: "owner author", userId: owner.userId },
    });

    const res = await updateBook(stranger.accessToken, created.body.id, {
      authors: [{ id: ownerAuthor.id }],
    });

    expect(res.status).toBe(404);
  });

  it("replaces the tag set with the provided one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia", "slow burn"],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { tags: ["cozy"] });

    expect(res.status).toBe(200);
    const names = res.body.tags.map((tag: { name: string }) => tag.name);
    expect(names).toEqual(["cozy"]);
    const items = await prisma.bookTag.findMany({ where: { bookId: created.body.id } });
    expect(items).toHaveLength(1);
  });

  it("clears all tags when an empty tag set is provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia"],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { tags: [] });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
    const items = await prisma.bookTag.findMany({ where: { bookId: created.body.id } });
    expect(items).toHaveLength(0);
  });

  it("leaves the existing tags in place when tags are absent from the payload", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia"],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    const names = res.body.tags.map((tag: { name: string }) => tag.name);
    expect(names).toEqual(["dark academia"]);
  });

  it("replaces the list membership with the provided list set", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await prisma.bookList.create({
      data: { name: "Gifts", normalizedName: "gifts", userId },
    });
    const second = await prisma.bookList.create({
      data: { name: "Autumn reads", normalizedName: "autumn reads", userId },
    });
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [first.id],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { listIds: [second.id] });

    expect(res.status).toBe(200);
    const listNames = res.body.lists.map((list: { name: string }) => list.name);
    expect(listNames).toEqual(["Autumn reads"]);
    const items = await prisma.bookListItem.findMany({ where: { bookId: created.body.id } });
    expect(items).toHaveLength(1);
  });
});

describe("PATCH /api/books/:id partial block merge", () => {
  it("updates only the provided loan sub-field and preserves the siblings", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanDate: "2026-02-01", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      loanInfo: { note: "return next week" },
    });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({
      loanDate: "2026-02-01",
      note: "return next week",
      personName: "Olha",
    });
    const rows = await prisma.bookLoanInfo.findMany({ where: { bookId: created.body.id } });
    expect(rows.at(0)?.personName).toBe("Olha");
    expect(rows.at(0)?.loanDate).not.toBeNull();
  });

  it("preserves stored rating and started date when only the current page is patched", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 400,
      readingProgress: { currentPage: 10, rating: 4, startedAt: "2026-02-01" },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { currentPage: 50 },
    });

    expect(res.status).toBe(200);
    expect(res.body.readingProgress).toMatchObject({
      currentPage: 50,
      rating: 4,
      startedAt: "2026-02-01",
    });
  });

  it("keeps the purchase info on an owned book when patching an unrelated field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      title: "Dune",
    });
    await request(app.getHttpServer())
      .post(`/api/books/${created.body.id}/ownership/mark-bought`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    const res = await updateBook(accessToken, created.body.id, { title: "Dune Reborn" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Dune Reborn");
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.purchaseInfo).toMatchObject({
      currency: "UAH",
      expectedPrice: 299.99,
      storeName: "Yakaboo",
    });
    const rows = await prisma.bookPurchaseInfo.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
  });

  it("clears a loan sub-field when an explicit null is sent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { note: "old note", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { loanInfo: { note: null } });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({ note: null, personName: "Olha" });
  });
});

describe("PATCH /api/books/:id cross-field validation", () => {
  it("returns 400 when the payload current page exceeds the payload page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      pagesCount: 300,
      readingProgress: { currentPage: 301 },
      readingStatus: "reading",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when a payload-only current page exceeds the stored page count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      readingProgress: { currentPage: 301 },
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when a payload-only page count drops below the stored current page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 250 },
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { pagesCount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when ownership is set to borrowed without loan info", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      ownershipStatus: "borrowed_from_someone",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanInfo.personName" })]),
    );
  });

  it("allows a status-only switch between loan statuses when the existing row has a person name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, {
      ownershipStatus: "lent_to_someone",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("lent_to_someone");
    expect(res.body.loanInfo).toMatchObject({ personName: "Olha" });
  });

  it("returns 400 for an unknown reading status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { readingStatus: "halfway" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingStatus" })]),
    );
  });
});

describe("PATCH /api/books/:id series part number", () => {
  it("rejects an update that reuses a part number held by another book in the series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      title: "Throne of Glass",
    });
    const second = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      seriesId: first.body.series.id,
      title: "Crown of Midnight",
    });

    const res = await updateBook(accessToken, second.body.id, { partNumber: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
  });

  it("allows a book to keep its own part number on an unrelated update", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      title: "Throne of Glass",
    });

    const res = await updateBook(accessToken, created.body.id, { title: "Throne of Glass (rev)" });

    expect(res.status).toBe(200);
    expect(res.body.partNumber).toBe(1);
    expect(res.body.title).toBe("Throne of Glass (rev)");
  });
});

describe("PATCH /api/books/:id reading queue", () => {
  it("adds the book to the queue and reflects membership in the returned view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.isInReadingQueue).toBe(false);

    const res = await updateBook(accessToken, created.body.id, {
      addToReadingQueue: true,
      queuePriority: "high",
    });

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(true);
    expect(res.body.queuePriority).toBe("high");
  });

  it("removes the book from the queue when toggled off", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    expect(created.body.isInReadingQueue).toBe(true);

    const res = await updateBook(accessToken, created.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
  });

  it("re-sequences the tail with no gap when a middle queued book is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const middle = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const last = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Children of Dune",
    });

    const res = await updateBook(accessToken, middle.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    const positions = await readQueuePositions(userId);
    expect(positions).toEqual([
      { id: first.body.id, queuePosition: 1 },
      { id: last.body.id, queuePosition: 2 },
    ]);
  });

  it("leaves earlier positions untouched when the last queued book is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const last = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Children of Dune",
    });

    const res = await updateBook(accessToken, last.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    const positions = await readQueuePositions(userId);
    expect(positions).toEqual([
      { id: first.body.id, queuePosition: 1 },
      { id: second.body.id, queuePosition: 2 },
    ]);
  });

  it("re-sequences the rest to start at 1 when the first queued book is removed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune Messiah",
    });
    const last = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Children of Dune",
    });

    const res = await updateBook(accessToken, first.body.id, { addToReadingQueue: false });

    expect(res.status).toBe(200);
    const positions = await readQueuePositions(userId);
    expect(positions).toEqual([
      { id: second.body.id, queuePosition: 1 },
      { id: last.body.id, queuePosition: 2 },
    ]);
  });
});

describe("PATCH /api/books/:id series progress recompute", () => {
  function searchSeries(accessToken: string): request.Test {
    return request(app.getHttpServer())
      .get("/api/series")
      .set("Authorization", `Bearer ${accessToken}`);
  }

  it("drops booksInSeries and finishedInSeries when a finished book is detached to solo", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Throne of Glass",
    });
    const seriesId = created.body.series.id;

    const res = await updateBook(accessToken, created.body.id, { bookType: "solo" });
    expect(res.status).toBe(200);
    expect(res.body.series).toBeNull();

    const after = await searchSeries(accessToken);
    const series = after.body.items.find((item: { id: string }) => item.id === seriesId);
    expect(series).toMatchObject({ booksInSeries: 0, finishedInSeries: 0 });
  });

  it("moves the finished book's contribution to the target series when reassigned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const source = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Throne of Glass",
    });
    const sourceSeriesId = source.body.series.id;
    const targetAnchor = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "A Court of Thorns" },
      partNumber: 1,
      title: "A Court of Thorns and Roses",
    });
    const targetSeriesId = targetAnchor.body.series.id;

    const res = await updateBook(accessToken, source.body.id, {
      bookType: "series_part",
      partNumber: 2,
      seriesId: targetSeriesId,
    });
    expect(res.status).toBe(200);
    expect(res.body.series.id).toBe(targetSeriesId);

    const search = await searchSeries(accessToken);
    const byId = new Map<string, { booksInSeries: number; finishedInSeries: number }>(
      search.body.items.map(
        (item: { booksInSeries: number; finishedInSeries: number; id: string }) => [
          item.id,
          { booksInSeries: item.booksInSeries, finishedInSeries: item.finishedInSeries },
        ],
      ),
    );
    expect(byId.get(sourceSeriesId)).toEqual({ booksInSeries: 0, finishedInSeries: 0 });
    expect(byId.get(targetSeriesId)).toEqual({ booksInSeries: 2, finishedInSeries: 1 });
  });
});

import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { QUEUE_VOLUME_BULK_MAX } from "@app/shared";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule],
    [{ provide: StoragePort, useValue: storageStub }],
  );
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

type SeedBookInput = {
  authorId: string;
  coverMediaId?: Nullable<string>;
  isFavorite?: boolean;
  ownershipStatus?: string;
  queuePosition?: Nullable<number>;
  queuePriority?: Nullable<string>;
  readingStatus?: string;
  title?: string;
  userId: string;
};

function patch(accessToken: string, path: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/bulk/${path}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function post(accessToken: string, path: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/bulk/${path}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function seedAuthor(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.author.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedBook(input: SeedBookInput): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authors: { create: [{ authorId: input.authorId, position: 0 }] },
      coverMediaId: input.coverMediaId ?? null,
      isFavorite: input.isFavorite ?? false,
      ownershipStatus: input.ownershipStatus ?? "none",
      queuePosition: input.queuePosition ?? null,
      queuePriority: input.queuePriority ?? null,
      readingStatus: input.readingStatus ?? "not_started",
      title: input.title ?? "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedList(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.bookList.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedMedia(input: { userId: string }): Promise<{ id: string }> {
  return prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 90,
      kind: "book_cover",
      sizeBytes: 1000,
      storageKey: `covers/${input.userId}/${Math.random()}`,
      userId: input.userId,
      width: 60,
    },
    select: { id: true },
  });
}

function seedTag(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.tag.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

async function stampOldUpdatedAt(listId: string): Promise<Date> {
  const old = new Date("2020-01-01T00:00:00.000Z");
  await prisma.$executeRaw`UPDATE book_lists SET updated_at = ${old} WHERE id::text = ${listId}`;
  return old;
}

async function updatedAtOf(listId: string): Promise<Date> {
  const list = await prisma.bookList.findUniqueOrThrow({ where: { id: listId } });
  return list.updatedAt;
}

describe("PATCH /api/books/bulk/favorite", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/books/bulk/favorite")
      .send({ bookIds: [MISSING_UUID], isFavorite: true });

    expect(res.status).toBe(401);
  });

  it("returns 400 when bookIds is empty", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await patch(accessToken, "favorite", { bookIds: [], isFavorite: true });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bookIds" })]),
    );
  });

  it("returns 400 when more than 100 bookIds are provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookIds = Array.from({ length: 101 }, () => randomUUID());

    const res = await patch(accessToken, "favorite", { bookIds, isFavorite: true });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bookIds" })]),
    );
  });

  it("sets the favorite flag on the owned books and reports the affected count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const first = await seedBook({ authorId: author.id, title: "A", userId });
    const second = await seedBook({ authorId: author.id, title: "B", userId });

    const res = await patch(accessToken, "favorite", {
      bookIds: [first.id, second.id],
      isFavorite: true,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ affected: 2 });
    const favorites = await prisma.book.count({ where: { isFavorite: true, userId } });
    expect(favorites).toBe(2);
  });

  it("never touches another user's books and counts only the owned ones", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    const ownerBook = await seedBook({
      authorId: ownerAuthor.id,
      title: "Mine",
      userId: owner.userId,
    });
    const strangerBook = await seedBook({
      authorId: strangerAuthor.id,
      title: "Theirs",
      userId: stranger.userId,
    });

    const res = await patch(owner.accessToken, "favorite", {
      bookIds: [ownerBook.id, strangerBook.id],
      isFavorite: true,
    });

    expect(res.body).toEqual({ affected: 1 });
    const strangerRow = await prisma.book.findUniqueOrThrow({ where: { id: strangerBook.id } });
    expect(strangerRow.isFavorite).toBe(false);
  });

  it("stamps favoriteAddedAt only on rows that were not already favorites", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const alreadyFavoritedAt = new Date("2026-01-01T10:00:00.000Z");
    const already = await seedBook({
      authorId: author.id,
      isFavorite: true,
      title: "Already",
      userId,
    });
    await prisma.book.update({
      data: { favoriteAddedAt: alreadyFavoritedAt },
      where: { id: already.id },
    });
    const fresh = await seedBook({ authorId: author.id, title: "Fresh", userId });

    const res = await patch(accessToken, "favorite", {
      bookIds: [already.id, fresh.id],
      isFavorite: true,
    });

    expect(res.body).toEqual({ affected: 1 });
    const alreadyRow = await prisma.book.findUniqueOrThrow({ where: { id: already.id } });
    expect(alreadyRow.favoriteAddedAt).toEqual(alreadyFavoritedAt);
    const freshRow = await prisma.book.findUniqueOrThrow({ where: { id: fresh.id } });
    expect(freshRow.isFavorite).toBe(true);
    expect(freshRow.favoriteAddedAt).not.toBeNull();
  });

  it("clears favoriteAddedAt when the books are unfavorited in bulk", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({ authorId: author.id, isFavorite: true, title: "A", userId });
    await prisma.book.update({
      data: { favoriteAddedAt: new Date("2026-01-01T10:00:00.000Z") },
      where: { id: book.id },
    });

    const res = await patch(accessToken, "favorite", { bookIds: [book.id], isFavorite: false });

    expect(res.body).toEqual({ affected: 1 });
    const row = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(row.isFavorite).toBe(false);
    expect(row.favoriteAddedAt).toBeNull();
  });
});

describe("PATCH /api/books/bulk/reading-status", () => {
  it("changes the reading status and reports the affected count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      readingStatus: "want_to_read",
      title: "A",
      userId,
    });

    const res = await patch(accessToken, "reading-status", {
      bookIds: [book.id],
      readingStatus: "finished",
    });

    expect(res.body).toEqual({ affected: 1 });
    const row = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(row.readingStatus).toBe("finished");
  });

  it("deletes the reading progress when the new status does not use progress", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      readingStatus: "reading",
      title: "A",
      userId,
    });
    await prisma.bookReadingProgress.create({ data: { bookId: book.id, currentPage: 42 } });

    await patch(accessToken, "reading-status", {
      bookIds: [book.id],
      readingStatus: "want_to_read",
    });

    const progress = await prisma.bookReadingProgress.findUnique({ where: { bookId: book.id } });
    expect(progress).toBeNull();
  });

  it("keeps the reading progress when the new status still uses progress", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      readingStatus: "reading",
      title: "A",
      userId,
    });
    await prisma.bookReadingProgress.create({ data: { bookId: book.id, currentPage: 42 } });

    await patch(accessToken, "reading-status", { bookIds: [book.id], readingStatus: "paused" });

    const progress = await prisma.bookReadingProgress.findUnique({ where: { bookId: book.id } });
    expect(progress?.currentPage).toBe(42);
  });
});

describe("PATCH /api/books/bulk/ownership-status", () => {
  it("marks the loan returned when ownership moves away from a loan status", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      ownershipStatus: "borrowed_from_someone",
      title: "A",
      userId,
    });
    await prisma.bookLoan.create({
      data: { bookId: book.id, personName: "Olha", type: "borrowed_from_someone", userId },
    });

    const res = await patch(accessToken, "ownership-status", {
      bookIds: [book.id],
      ownershipStatus: "owned",
    });

    expect(res.body).toEqual({ affected: 1 });
    const loan = await prisma.bookLoan.findFirst({ where: { bookId: book.id } });
    expect(loan?.status).toBe("returned");
    expect(loan?.returnedAt).not.toBeNull();
  });

  it("rejects bulk-setting a loan ownership status and leaves books unchanged", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      ownershipStatus: "none",
      title: "A",
      userId,
    });

    const res = await patch(accessToken, "ownership-status", {
      bookIds: [book.id],
      ownershipStatus: "borrowed_from_someone",
    });

    expect(res.status).toBe(400);
    const stored = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(stored.ownershipStatus).toBe("none");
    const loans = await prisma.bookLoan.findMany({ where: { bookId: book.id } });
    expect(loans).toHaveLength(0);
  });

  it("cancels the active delivery when ownership moves away from in_transit", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      ownershipStatus: "in_transit",
      title: "A",
      userId,
    });
    await prisma.bookDelivery.create({
      data: { bookId: book.id, status: "ordered", storeName: "Yakaboo", userId },
    });

    await patch(accessToken, "ownership-status", { bookIds: [book.id], ownershipStatus: "owned" });

    const deliveries = await prisma.bookDelivery.findMany({ where: { bookId: book.id } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.status).toBe("cancelled");
  });

  it("keeps the purchase block when ownership moves from want_to_buy to owned", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      ownershipStatus: "want_to_buy",
      title: "A",
      userId,
    });
    await prisma.bookPurchaseInfo.create({ data: { bookId: book.id, storeName: "Yakaboo" } });

    await patch(accessToken, "ownership-status", { bookIds: [book.id], ownershipStatus: "owned" });

    const purchase = await prisma.bookPurchaseInfo.findUnique({ where: { bookId: book.id } });
    expect(purchase?.storeName).toBe("Yakaboo");
  });

  it("deletes the purchase block when ownership moves to a status without purchase", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      ownershipStatus: "want_to_buy",
      title: "A",
      userId,
    });
    await prisma.bookPurchaseInfo.create({ data: { bookId: book.id, storeName: "Yakaboo" } });

    await patch(accessToken, "ownership-status", { bookIds: [book.id], ownershipStatus: "none" });

    const purchase = await prisma.bookPurchaseInfo.findUnique({ where: { bookId: book.id } });
    expect(purchase).toBeNull();
  });
});

describe("POST /api/books/bulk/tags", () => {
  it("adds tags additively without removing existing ones or duplicating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const existing = await seedTag({ name: "dragons", userId });
    const book = await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        tags: { create: [{ tagId: existing.id }] },
        title: "A",
        userId,
      },
      select: { id: true },
    });

    const res = await post(accessToken, "tags", {
      bookIds: [book.id],
      tags: ["dragons", "slow burn"],
    });

    expect(res.body).toEqual({ affected: 1 });
    const tags = await prisma.bookTag.findMany({ where: { bookId: book.id } });
    expect(tags).toHaveLength(2);
    const userTags = await prisma.tag.count({ where: { userId } });
    expect(userTags).toBe(2);
  });

  it("only affects the caller's own books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    const ownerBook = await seedBook({
      authorId: ownerAuthor.id,
      title: "Mine",
      userId: owner.userId,
    });
    const strangerBook = await seedBook({
      authorId: strangerAuthor.id,
      title: "Theirs",
      userId: stranger.userId,
    });

    const res = await post(owner.accessToken, "tags", {
      bookIds: [ownerBook.id, strangerBook.id],
      tags: ["shared tag"],
    });

    expect(res.body).toEqual({ affected: 1 });
    const strangerTags = await prisma.bookTag.count({ where: { bookId: strangerBook.id } });
    expect(strangerTags).toBe(0);
  });
});

describe("POST /api/books/bulk/lists", () => {
  it("adds books to existing lists additively without duplicating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const listA = await seedList({ name: "Gifts", userId });
    const listB = await seedList({ name: "Autumn", userId });
    const book = await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        lists: { create: [{ listId: listA.id, position: 1 }] },
        title: "A",
        userId,
      },
      select: { id: true },
    });

    const res = await post(accessToken, "lists", {
      bookIds: [book.id],
      listIds: [listA.id, listB.id],
    });

    expect(res.body).toEqual({ affected: 1 });
    const items = await prisma.bookListItem.findMany({ where: { bookId: book.id } });
    expect(items).toHaveLength(2);
  });

  it("creates new lists and adds the books to them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({ authorId: author.id, title: "A", userId });

    const res = await post(accessToken, "lists", {
      bookIds: [book.id],
      newLists: [{ name: "Autumn reads" }],
    });

    expect(res.body).toEqual({ affected: 1 });
    const lists = await prisma.bookList.findMany({ where: { userId } });
    expect(lists).toHaveLength(1);
    const items = await prisma.bookListItem.findMany({ where: { bookId: book.id } });
    expect(items).toHaveLength(1);
  });

  it("appends new members at gapless positions after existing ones without duplicating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const list = await seedList({ name: "Gifts", userId });
    const existing = await seedBook({ authorId: author.id, title: "Existing", userId });
    await prisma.bookListItem.create({
      data: { bookId: existing.id, listId: list.id, position: 1 },
    });
    const first = await seedBook({ authorId: author.id, title: "First", userId });
    const second = await seedBook({ authorId: author.id, title: "Second", userId });

    const res = await post(accessToken, "lists", {
      bookIds: [existing.id, first.id, second.id],
      listIds: [list.id],
    });

    expect(res.body).toEqual({ affected: 3 });
    const items = await prisma.bookListItem.findMany({
      orderBy: { position: "asc" },
      select: { bookId: true, position: true },
      where: { listId: list.id },
    });
    expect(items).toEqual([
      { bookId: existing.id, position: 1 },
      { bookId: first.id, position: 2 },
      { bookId: second.id, position: 3 },
    ]);
  });

  it("advances the list updatedAt after a bulk add", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const list = await seedList({ name: "Gifts", userId });
    const book = await seedBook({ authorId: author.id, title: "A", userId });
    const before = await stampOldUpdatedAt(list.id);

    await post(accessToken, "lists", { bookIds: [book.id], listIds: [list.id] }).expect(200);

    const after = await updatedAtOf(list.id);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("POST /api/books/bulk/reading-queue", () => {
  it("queues unqueued books with sequential positions in input order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const first = await seedBook({ authorId: author.id, title: "A", userId });
    const second = await seedBook({ authorId: author.id, title: "B", userId });
    const third = await seedBook({ authorId: author.id, title: "C", userId });

    const res = await post(accessToken, "reading-queue", {
      bookIds: [first.id, second.id, third.id],
    });

    expect(res.body).toEqual({ affected: 3 });
    const rows = await prisma.book.findMany({
      orderBy: { queuePosition: "asc" },
      select: { queuePosition: true, queuePriority: true, title: true },
      where: { userId },
    });
    expect(rows).toEqual([
      { queuePosition: 1, queuePriority: "normal", title: "A" },
      { queuePosition: 2, queuePriority: "normal", title: "B" },
      { queuePosition: 3, queuePriority: "normal", title: "C" },
    ]);
  });

  it("skips books that are already queued and appends after the highest position", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const queued = await seedBook({
      authorId: author.id,
      queuePosition: 3,
      queuePriority: "high",
      title: "Queued",
      userId,
    });
    const fresh1 = await seedBook({ authorId: author.id, title: "Fresh1", userId });
    const fresh2 = await seedBook({ authorId: author.id, title: "Fresh2", userId });

    const res = await post(accessToken, "reading-queue", {
      bookIds: [fresh2.id, fresh1.id, queued.id],
    });

    expect(res.body).toEqual({ affected: 2 });
    const queuedRow = await prisma.book.findUniqueOrThrow({ where: { id: queued.id } });
    expect(queuedRow.queuePosition).toBe(3);
    const fresh2Row = await prisma.book.findUniqueOrThrow({ where: { id: fresh2.id } });
    const fresh1Row = await prisma.book.findUniqueOrThrow({ where: { id: fresh1.id } });
    expect(fresh2Row.queuePosition).toBe(4);
    expect(fresh1Row.queuePosition).toBe(5);
  });
});

describe("POST /api/books/bulk/delete", () => {
  it("hard deletes the owned books and reports the affected count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const first = await seedBook({ authorId: author.id, title: "A", userId });
    const second = await seedBook({ authorId: author.id, title: "B", userId });

    const res = await post(accessToken, "delete", { bookIds: [first.id, second.id] });

    expect(res.body).toEqual({ affected: 2 });
    const remaining = await prisma.book.count({ where: { userId } });
    expect(remaining).toBe(0);
  });

  it("removes an orphaned cover whose only book was deleted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const media = await seedMedia({ userId });
    const book = await seedBook({
      authorId: author.id,
      coverMediaId: media.id,
      title: "A",
      userId,
    });

    await post(accessToken, "delete", { bookIds: [book.id] });

    const mediaRow = await prisma.mediaAsset.findUnique({ where: { id: media.id } });
    expect(mediaRow).toBeNull();
  });

  it("keeps a cover that is still referenced by another book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const media = await seedMedia({ userId });
    const first = await seedBook({
      authorId: author.id,
      coverMediaId: media.id,
      title: "A",
      userId,
    });
    await seedBook({ authorId: author.id, coverMediaId: media.id, title: "B", userId });

    await post(accessToken, "delete", { bookIds: [first.id] });

    const mediaRow = await prisma.mediaAsset.findUnique({ where: { id: media.id } });
    expect(mediaRow).not.toBeNull();
  });

  it("never deletes another user's books and counts only the owned ones", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    const ownerBook = await seedBook({
      authorId: ownerAuthor.id,
      title: "Mine",
      userId: owner.userId,
    });
    const strangerBook = await seedBook({
      authorId: strangerAuthor.id,
      title: "Theirs",
      userId: stranger.userId,
    });

    const res = await post(owner.accessToken, "delete", {
      bookIds: [ownerBook.id, strangerBook.id],
    });

    expect(res.body).toEqual({ affected: 1 });
    const strangerRow = await prisma.book.findUnique({ where: { id: strangerBook.id } });
    expect(strangerRow).not.toBeNull();
  });
});

function seedPagesBook(input: {
  authorId: string;
  currentPage?: Nullable<number>;
  pagesCount?: Nullable<number>;
  pagesCountUnavailable?: boolean;
  userId: string;
}): Promise<{ id: string; updatedAt: Date }> {
  const currentPage = input.currentPage ?? null;
  return prisma.book.create({
    data: {
      authors: { create: [{ authorId: input.authorId, position: 0 }] },
      pagesCount: input.pagesCount ?? null,
      pagesCountUnavailable: input.pagesCountUnavailable ?? false,
      readingProgress: currentPage === null ? undefined : { create: { currentPage } },
      readingStatus: "reading",
      title: "Pages book",
      userId: input.userId,
    },
    select: { id: true, updatedAt: true },
  });
}

describe("PATCH /api/books/bulk/pages-count", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/books/bulk/pages-count")
      .send({ items: [] });

    expect(res.status).toBe(401);
  });

  it("updates owned books and reports foreign books as not_found", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    const first = await seedPagesBook({ authorId: author.id, userId });
    const second = await seedPagesBook({ authorId: author.id, userId });
    const foreign = await seedPagesBook({ authorId: strangerAuthor.id, userId: stranger.userId });

    const res = await patch(accessToken, "pages-count", {
      items: [
        {
          bookId: first.id,
          expectedUpdatedAt: first.updatedAt.toISOString(),
          kind: "pages_count",
          pagesCount: 300,
        },
        {
          bookId: second.id,
          expectedUpdatedAt: second.updatedAt.toISOString(),
          kind: "pages_count",
          pagesCount: 250,
        },
        {
          bookId: foreign.id,
          expectedUpdatedAt: foreign.updatedAt.toISOString(),
          kind: "pages_count",
          pagesCount: 100,
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toHaveLength(2);
    expect(res.body.updated).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(res.body.failed).toEqual([{ bookId: foreign.id, reason: "not_found" }]);

    const firstRow = await prisma.book.findUniqueOrThrow({
      select: { pagesCount: true },
      where: { id: first.id },
    });
    expect(firstRow.pagesCount).toBe(300);
    const foreignRow = await prisma.book.findUniqueOrThrow({
      select: { pagesCount: true },
      where: { id: foreign.id },
    });
    expect(foreignRow.pagesCount).toBeNull();
  });

  it("fails as stale and does not write when the expected updatedAt does not match", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedPagesBook({ authorId: author.id, pagesCount: 100, userId });

    const res = await patch(accessToken, "pages-count", {
      items: [
        {
          bookId: book.id,
          expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
          kind: "pages_count",
          pagesCount: 555,
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual([]);
    expect(res.body.failed).toEqual([{ bookId: book.id, reason: "stale" }]);

    const row = await prisma.book.findUniqueOrThrow({
      select: { pagesCount: true },
      where: { id: book.id },
    });
    expect(row.pagesCount).toBe(100);
  });

  it("blocks a page count below the stored current page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedPagesBook({
      authorId: author.id,
      currentPage: 250,
      pagesCount: 400,
      userId,
    });

    const res = await patch(accessToken, "pages-count", {
      items: [
        {
          bookId: book.id,
          expectedUpdatedAt: book.updatedAt.toISOString(),
          kind: "pages_count",
          pagesCount: 200,
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual([]);
    expect(res.body.failed).toEqual([{ bookId: book.id, reason: "below_current_page" }]);

    const row = await prisma.book.findUniqueOrThrow({
      select: { pagesCount: true },
      where: { id: book.id },
    });
    expect(row.pagesCount).toBe(400);
  });

  it("clears the unavailable flag when a real page count is provided", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedPagesBook({ authorId: author.id, pagesCountUnavailable: true, userId });

    const res = await patch(accessToken, "pages-count", {
      items: [
        {
          bookId: book.id,
          expectedUpdatedAt: book.updatedAt.toISOString(),
          kind: "pages_count",
          pagesCount: 288,
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual([book.id]);
    expect(res.body.failed).toEqual([]);

    const row = await prisma.book.findUniqueOrThrow({
      select: { pagesCount: true, pagesCountUnavailable: true },
      where: { id: book.id },
    });
    expect(row.pagesCount).toBe(288);
    expect(row.pagesCountUnavailable).toBe(false);
  });

  it("marks the pages count as unavailable without touching the stored page count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedPagesBook({ authorId: author.id, pagesCount: 321, userId });

    const res = await patch(accessToken, "pages-count", {
      items: [
        {
          bookId: book.id,
          expectedUpdatedAt: book.updatedAt.toISOString(),
          kind: "pages_count_unavailable",
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toEqual([book.id]);
    expect(res.body.failed).toEqual([]);

    const row = await prisma.book.findUniqueOrThrow({
      select: { pagesCount: true, pagesCountUnavailable: true },
      where: { id: book.id },
    });
    expect(row.pagesCountUnavailable).toBe(true);
    expect(row.pagesCount).toBe(321);
  });

  it("returns 400 when more items than the bulk maximum are provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const items = Array.from({ length: QUEUE_VOLUME_BULK_MAX + 1 }, () => ({
      bookId: randomUUID(),
      expectedUpdatedAt: new Date().toISOString(),
      kind: "pages_count",
      pagesCount: 100,
    }));

    const res = await patch(accessToken, "pages-count", { items });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "items" })]),
    );
  });
});

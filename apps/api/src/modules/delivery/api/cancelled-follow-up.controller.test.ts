import type {
  CancelledFollowUpView,
  CancelledFollowUpWishlistResult,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { addDays, subDays } from "date-fns";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { DeliveryModule } from "../delivery.module.js";
import { getJson, ORDER_ROUTES, postJson } from "./book-order.fixtures.js";

type SeededBook = SeededItem & {
  items?: SeededItem[];
  ownershipStatus?: OwnershipStatus;
  partNumber?: number;
  queuePosition?: number;
  readingStatus?: ReadingStatus;
  seriesId?: string;
  title: string;
  trashed?: boolean;
};

type SeededItem = {
  cancelledAt?: Nullable<Date>;
  cancelReason?: string;
  receivedAt?: Date;
};

const CANCELLED_AT = new Date("2026-08-10T10:00:00.000Z");
const SECOND_CANCELLED_AT = new Date("2026-08-14T10:00:00.000Z");
const RECEIVED_AT = new Date("2026-08-16T10:00:00.000Z");
const NOT_TRASHED = { deletedAt: null, purgeAt: null } as const;
const TRASHED_AT = new Date("2026-08-03T10:00:00.000Z");

let context: AuthTestContext;
let app: INestApplication;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, DeliveryModule]);
  app = context.app;
});

beforeEach(async () => {
  context.reset();
  reader = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function followUp(): Promise<CancelledFollowUpView> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.cancelledFollowUp,
  });
  expect(res.status).toBe(200);
  return res.body as CancelledFollowUpView;
}

async function ownershipById(bookId: string): Promise<string> {
  const book = await app.get(PrismaService).book.findUniqueOrThrow({ where: { id: bookId } });
  return book.ownershipStatus;
}

async function returnAllToWishlist(): Promise<CancelledFollowUpWishlistResult> {
  const res = await postJson({
    accessToken: reader.accessToken,
    app,
    path: ORDER_ROUTES.cancelledFollowUpWantToBuy,
  });
  expect(res.status).toBe(200);
  return res.body as CancelledFollowUpWishlistResult;
}

async function seedBooks(books: SeededBook[]): Promise<Map<string, string>> {
  const prisma = app.get(PrismaService);
  const order = await prisma.bookOrder.create({
    data: { storeName: "Yakaboo", userId: reader.userId },
  });
  const bookIds = new Map<string, string>();

  for (const seeded of books) {
    const book = await prisma.book.create({
      data: {
        ...(seeded.trashed === true ? TRASH_RETENTION.stamp(TRASHED_AT) : NOT_TRASHED),
        firstAuthorName: "Frank Herbert",
        ownershipStatus: seeded.ownershipStatus ?? "none",
        partNumber: seeded.partNumber ?? null,
        queuePosition: seeded.queuePosition ?? null,
        readingStatus: seeded.readingStatus ?? "not_started",
        seriesId: seeded.seriesId ?? null,
        title: seeded.title,
        userId: reader.userId,
      },
    });
    bookIds.set(seeded.title, book.id);

    const items = seeded.items ?? [
      {
        cancelledAt: seeded.cancelledAt === undefined ? CANCELLED_AT : seeded.cancelledAt,
        cancelReason: seeded.cancelReason,
        receivedAt: seeded.receivedAt,
      },
    ];
    for (const item of items) {
      await prisma.bookOrderItem.create({
        data: {
          bookId: book.id,
          cancelledAt: item.cancelledAt ?? null,
          cancelReason: item.cancelReason ?? null,
          orderId: order.id,
          receivedAt: item.receivedAt ?? null,
        },
      });
    }
  }

  return bookIds;
}

async function seedGoal({
  archivedAt = null,
  books,
  createdAt,
  deadline,
  name = "Осіннє читання",
  targetCount = 5,
}: {
  archivedAt?: Nullable<Date>;
  books: { id: string; qualifiedFinishedAt?: Date }[];
  createdAt?: Date;
  deadline?: Date;
  name?: Nullable<string>;
  targetCount?: number;
}): Promise<string> {
  const prisma = app.get(PrismaService);
  const goal = await prisma.readingGoal.create({
    data: {
      archivedAt,
      ...(createdAt === undefined ? {} : { createdAt }),
      deadline: deadline ?? addDays(new Date(), 30),
      name,
      targetCount,
      userId: reader.userId,
    },
  });
  for (const [position, book] of books.entries()) {
    await prisma.readingGoalBook.create({
      data: {
        bookId: book.id,
        goalId: goal.id,
        position,
        qualifiedFinishedAt: book.qualifiedFinishedAt ?? null,
      },
    });
  }
  return goal.id;
}

async function seedSeries(name: string, totalBooks: Nullable<number> = null): Promise<string> {
  const series = await app.get(PrismaService).series.create({
    data: {
      ...NOT_TRASHED,
      name,
      normalizedName: name.toLowerCase(),
      totalBooks,
      userId: reader.userId,
    },
  });
  return series.id;
}

describe("books that need a decision", () => {
  it("stays quiet while nothing was cancelled", async () => {
    await seedBooks([{ cancelledAt: null, ownershipStatus: "owned", title: "Received" }]);

    expect(await followUp()).toEqual({ plans: null, unresolved: null });
  });

  it("keeps a cancelled book that never reached a next step", async () => {
    await seedBooks([{ cancelReason: "Sold out", title: "Поклик з могили" }]);

    const view = await followUp();

    expect(view.unresolved?.booksCount).toBe(1);
    expect(view.unresolved?.books[0]).toMatchObject({
      authorName: "Frank Herbert",
      cancelledAt: CANCELLED_AT.toISOString(),
      cancelReason: "Sold out",
      title: "Поклик з могили",
    });
  });

  it("drops every book that already carries a next acquisition state", async () => {
    const seriesId = await seedSeries("Мерці");
    await seedBooks([
      { ownershipStatus: "owned", title: "Bought after the cancellation" },
      { ownershipStatus: "want_to_buy", title: "Back in the wishlist" },
      { ownershipStatus: "in_transit", title: "Ordered again" },
      { ownershipStatus: "borrowed_from_someone", title: "Borrowed instead" },
      { seriesId, title: "Still undecided" },
      { title: "Trashed", trashed: true },
      {
        items: [
          { cancelledAt: CANCELLED_AT },
          { receivedAt: new Date("2026-08-12T10:00:00.000Z") },
        ],
        title: "Cancelled once, received later",
      },
      {
        items: [{ cancelledAt: CANCELLED_AT }, {}],
        title: "Cancelled once, on its way again",
      },
    ]);

    const view = await followUp();

    expect(view.unresolved?.booksCount).toBe(1);
    expect(view.unresolved?.books.map((book) => book.title)).toEqual(["Still undecided"]);
  });

  it("previews the three newest cancellations and counts the rest", async () => {
    await seedBooks(
      [1, 2, 3, 4].map((day) => ({
        cancelledAt: new Date(`2026-08-0${day}T10:00:00.000Z`),
        title: `Book ${day}`,
      })),
    );

    const view = await followUp();

    expect(view.unresolved?.booksCount).toBe(4);
    expect(view.unresolved?.books.map((book) => book.title)).toEqual([
      "Book 4",
      "Book 3",
      "Book 2",
    ]);
  });
});

describe("books the plans still count on", () => {
  it("stays out when no unresolved book touches a plan", async () => {
    await seedBooks([{ title: "Nobody waits for it" }]);

    expect((await followUp()).plans).toBeNull();
  });

  it("carries the queue, the goal and the series in one row per book", async () => {
    const seriesId = await seedSeries("Мерці", 2);
    const bookIds = await seedBooks([
      { partNumber: 1, readingStatus: "finished", seriesId, title: "Прочитана перша" },
      { partNumber: 2, queuePosition: 1, seriesId, title: "Невгамовні мерці" },
    ]);
    await seedGoal({ books: [{ id: bookIds.get("Невгамовні мерці") ?? "" }] });

    const view = await followUp();

    expect(view.plans?.booksCount).toBe(1);
    expect(view.plans?.books[0]?.title).toBe("Невгамовні мерці");
    expect(view.plans?.books[0]?.contexts).toEqual([
      { kind: "queue" },
      { goalName: "Осіннє читання", goalsCount: 1, kind: "goal", riskLevel: expect.any(String) },
      { kind: "series_next" },
    ]);
  });

  it("ignores goals that are no longer active or already count the book", async () => {
    const bookIds = await seedBooks([
      { title: "In an archived goal" },
      { title: "In an expired goal" },
      { title: "In a reached goal" },
      { title: "Already counted" },
    ]);
    await seedGoal({
      archivedAt: new Date("2026-08-01T10:00:00.000Z"),
      books: [{ id: bookIds.get("In an archived goal") ?? "" }],
    });
    await seedGoal({
      books: [{ id: bookIds.get("In an expired goal") ?? "" }],
      deadline: subDays(new Date(), 2),
    });
    await seedGoal({
      books: [
        { id: bookIds.get("In a reached goal") ?? "" },
        { id: bookIds.get("Already counted") ?? "", qualifiedFinishedAt: subDays(new Date(), 5) },
      ],
      createdAt: subDays(new Date(), 10),
      targetCount: 1,
    });

    expect((await followUp()).plans).toBeNull();
  });
});

describe("returning every undecided book to the wishlist", () => {
  it("moves the whole unresolved set and leaves the cancellation history alone", async () => {
    const bookIds = await seedBooks([
      { title: "Перша" },
      { title: "Друга" },
      { ownershipStatus: "owned", title: "Bought meanwhile" },
    ]);
    const prisma = app.get(PrismaService);

    expect(await returnAllToWishlist()).toEqual({ updatedCount: 2 });

    expect(await ownershipById(bookIds.get("Перша") ?? "")).toBe("want_to_buy");
    expect(await ownershipById(bookIds.get("Друга") ?? "")).toBe("want_to_buy");
    expect(await ownershipById(bookIds.get("Bought meanwhile") ?? "")).toBe("owned");
    expect(await prisma.bookOrderItem.count({ where: { cancelledAt: { not: null } } })).toBe(3);
    expect((await followUp()).unresolved).toBeNull();
  });

  it("stamps the wishlist date so the book sorts with the rest of the wishlist", async () => {
    const bookIds = await seedBooks([{ title: "Перша" }]);

    await returnAllToWishlist();

    const book = await app
      .get(PrismaService)
      .book.findUniqueOrThrow({ where: { id: bookIds.get("Перша") ?? "" } });
    expect(book.wishlistAddedAt).not.toBeNull();
  });

  it("reports nothing to do when every cancelled book already moved on", async () => {
    await seedBooks([{ ownershipStatus: "owned", title: "Bought" }]);

    expect(await returnAllToWishlist()).toEqual({ updatedCount: 0 });
  });
});

describe("where the cancelled books ended up", () => {
  it("reports nothing at all until a book has actually been cancelled", async () => {
    await seedBooks([{ cancelledAt: null, receivedAt: RECEIVED_AT, title: "Отримана" }]);

    expect((await followUp()).outcomes).toBeNull();
  });

  it("counts a book cancelled twice only once", async () => {
    await seedBooks([
      {
        items: [
          { cancelledAt: CANCELLED_AT, cancelReason: "Немає в наявності" },
          { cancelledAt: SECOND_CANCELLED_AT, cancelReason: "Знову немає" },
        ],
        title: "Двічі скасована",
      },
    ]);

    const outcomes = (await followUp()).outcomes;
    expect(outcomes?.totalBooksCount).toBe(1);
    expect(outcomes?.unresolved).toBe(1);
  });

  it("counts a book that arrived in a later order as being in the library", async () => {
    await seedBooks([
      {
        items: [{ cancelledAt: CANCELLED_AT }, { receivedAt: RECEIVED_AT }],
        ownershipStatus: "owned",
        title: "Приїхала другим разом",
      },
    ]);

    expect((await followUp()).outcomes).toMatchObject({ inLibrary: 1, totalBooksCount: 1 });
  });

  it("counts a book carried by a fresh open order as reordered", async () => {
    await seedBooks([
      {
        items: [{ cancelledAt: CANCELLED_AT }, {}],
        ownershipStatus: "in_transit",
        title: "Замовлена знову",
      },
    ]);

    expect((await followUp()).outcomes).toMatchObject({ reordered: 1, totalBooksCount: 1 });
  });

  it("counts a book put back on the wishlist as wishlist", async () => {
    await seedBooks([{ ownershipStatus: "want_to_buy", title: "У бажаних" }]);

    expect((await followUp()).outcomes).toMatchObject({ totalBooksCount: 1, wishlist: 1 });
  });

  it("counts a book borrowed from someone separately from an owned one", async () => {
    await seedBooks([{ ownershipStatus: "borrowed_from_someone", title: "Позичена" }]);

    expect((await followUp()).outcomes).toMatchObject({
      borrowed: 1,
      inLibrary: 0,
      totalBooksCount: 1,
    });
  });

  it("counts a book with nothing lined up as unresolved, matching the decision block", async () => {
    await seedBooks([{ title: "Без кроку" }]);

    const view = await followUp();
    expect(view.outcomes).toMatchObject({ totalBooksCount: 1, unresolved: 1 });
    expect(view.unresolved?.booksCount).toBe(1);
  });

  it("leaves a trashed book out of the tally", async () => {
    await seedBooks([{ title: "Жива" }, { title: "У кошику", trashed: true }]);

    expect((await followUp()).outcomes?.totalBooksCount).toBe(1);
  });

  it("splits every book across the outcomes so they add up to the total", async () => {
    await seedBooks([
      { items: [{ cancelledAt: CANCELLED_AT }, { receivedAt: RECEIVED_AT }], title: "Отримана" },
      { ownershipStatus: "owned", title: "Куплена деінде" },
      { ownershipStatus: "lent_to_someone", title: "Віддана почитати" },
      { items: [{ cancelledAt: CANCELLED_AT }, {}], title: "Замовлена знову" },
      { ownershipStatus: "want_to_buy", title: "У бажаних" },
      { ownershipStatus: "borrowed_from_someone", title: "Позичена" },
      { title: "Без кроку" },
    ]);

    const outcomes = (await followUp()).outcomes;
    expect(outcomes).toEqual({
      borrowed: 1,
      inLibrary: 3,
      reordered: 1,
      totalBooksCount: 7,
      unresolved: 1,
      wishlist: 1,
    });
    expect(
      (outcomes?.borrowed ?? 0) +
        (outcomes?.inLibrary ?? 0) +
        (outcomes?.reordered ?? 0) +
        (outcomes?.unresolved ?? 0) +
        (outcomes?.wishlist ?? 0),
    ).toBe(outcomes?.totalBooksCount);
  });

  it("ignores whatever the history list is filtered down to", async () => {
    await seedBooks([
      { ownershipStatus: "owned", title: "Куплена деінде" },
      { ownershipStatus: "want_to_buy", title: "У бажаних" },
      { title: "Без кроку" },
    ]);
    const before = (await followUp()).outcomes;

    const narrowed = await getJson({
      accessToken: reader.accessToken,
      app,
      path: `${ORDER_ROUTES.history}?tab=cancelled&q=${encodeURIComponent("Без кроку")}`,
    });
    expect(narrowed.status).toBe(200);

    expect((await followUp()).outcomes).toEqual(before);
    expect(before).toMatchObject({ inLibrary: 1, totalBooksCount: 3, unresolved: 1, wishlist: 1 });
  });

  it("keeps reporting the tally once no book needs a decision any more", async () => {
    await seedBooks([{ ownershipStatus: "owned", title: "Куплена деінде" }]);

    const view = await followUp();
    expect(view.unresolved).toBeNull();
    expect(view.plans).toBeNull();
    expect(view.outcomes).toMatchObject({ inLibrary: 1, totalBooksCount: 1 });
  });
});

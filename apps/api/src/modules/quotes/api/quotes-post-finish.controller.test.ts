import type { PostFinishQuotesView, QuotesOverviewView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { defaultUserProfileSettings, QuotesOverviewViewSchema } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { insertFinishedReadingCycle } from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QUOTE_PURGE_QUEUE_NAME } from "../domain/quote-purge.js";
import { QuotesModule } from "../quotes.module.js";

const UNKNOWN_CYCLE_ID = "11111111-1111-4111-8111-111111111111";

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, QuotesModule, BooksModule],
    [{ provide: getQueueToken(QUOTE_PURGE_QUEUE_NAME), useValue: queueStub }],
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

async function addQuote({
  accessToken,
  bookId,
  text,
  ...body
}: {
  accessToken: string;
  bookId: string;
  comment?: string;
  isFavorite?: boolean;
  isSpoiler?: boolean;
  text: string;
}): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`/api/books/${bookId}/quotes`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ text, ...body });
  if (res.status !== HttpStatus.CREATED) {
    throw new Error(`quote creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

async function countReviews(): Promise<number> {
  return prisma.quotePostFinishReview.count();
}

async function createBook(accessToken: string, title: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], title });
  if (res.status !== HttpStatus.CREATED) {
    throw new Error(`book creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

function daysAgo(days: number): string {
  return addDaysToIsoDate(readerToday(), -days);
}

function expectSelected(
  postFinish: QuotesOverviewView["postFinish"],
): asserts postFinish is PostFinishQuotesView {
  expect(postFinish).not.toBeNull();
}

async function overviewBody(accessToken: string): Promise<QuotesOverviewView> {
  const res = await request(app.getHttpServer())
    .get("/api/quotes/overview")
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(HttpStatus.OK);
  return QuotesOverviewViewSchema.parse(res.body);
}

async function postFinishOf(accessToken: string): Promise<QuotesOverviewView["postFinish"]> {
  const { postFinish } = await overviewBody(accessToken);
  return postFinish;
}

function readerToday(): string {
  return toZonedIsoDate({
    instant: new Date(),
    timeZone: defaultUserProfileSettings.timezone,
  });
}

function review(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/quotes/post-finish/review")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function seedFinishedBook({
  accessToken,
  finishedIsoDate,
  quoteTexts,
  title,
  userId,
}: {
  accessToken: string;
  finishedIsoDate: string;
  quoteTexts: string[];
  title: string;
  userId: string;
}): Promise<{ bookId: string; readingCycleId: string }> {
  const bookId = await createBook(accessToken, title);
  for (const text of quoteTexts) {
    await addQuote({ accessToken, bookId, text });
  }
  const readingCycleId = await insertFinishedReadingCycle(prisma, {
    bookId,
    finishedIsoDate,
    userId,
  });
  return { bookId, readingCycleId };
}

describe("GET /api/quotes/overview — postFinish selection", () => {
  it("offers no recap while the reader finished nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBook(accessToken, "Dune");

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("recaps a book finished today with its canonical counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addQuote({ accessToken, bookId, isFavorite: true, text: "Fear is the mind-killer" });
    await addQuote({
      accessToken,
      bookId,
      comment: "worth rereading",
      text: "The spice must flow",
    });
    await addQuote({ accessToken, bookId, isSpoiler: true, text: "The traitor is revealed" });
    const readingCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: readerToday(),
      userId,
    });

    const postFinish = await postFinishOf(accessToken);

    expectSelected(postFinish);
    expect(postFinish).toMatchObject({
      favoritesCount: 1,
      finishedAt: readerToday(),
      quotesCount: 3,
      readingCycleId,
      withCommentCount: 1,
    });
    expect(postFinish.book).toMatchObject({
      cover: null,
      firstAuthorName: "Frank Herbert",
      id: bookId,
      title: "Dune",
    });
  });

  it("keeps a trashed quote out of the counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addQuote({ accessToken, bookId, text: "Fear is the mind-killer" });
    const trashedQuoteId = await addQuote({ accessToken, bookId, text: "A line to remove" });
    await insertFinishedReadingCycle(prisma, { bookId, finishedIsoDate: daysAgo(2), userId });
    await prisma.quote.update({
      data: { deletedAt: new Date(), purgeAt: new Date() },
      where: { id: trashedQuoteId },
    });

    const postFinish = await postFinishOf(accessToken);

    expectSelected(postFinish);
    expect(postFinish.quotesCount).toBe(1);
  });

  it("still recaps a cycle finished exactly thirty days ago", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { readingCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(30),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });

    const postFinish = await postFinishOf(accessToken);

    expectSelected(postFinish);
    expect(postFinish.readingCycleId).toBe(readingCycleId);
  });

  it("drops a cycle finished one day past the window", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(31),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("drops a cycle finished in the future", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(-1),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("ignores a reading cycle that is still active", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addQuote({ accessToken, bookId, text: "Fear is the mind-killer" });
    await prisma.bookReadingCycle.create({
      data: { bookId, startedAt: parseIsoDate(daysAgo(3)), state: "active", userId },
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("ignores a finished cycle that carries no finished date", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken, "Dune");
    await addQuote({ accessToken, bookId, text: "Fear is the mind-killer" });
    await prisma.bookReadingCycle.create({
      data: { bookId, finishedAt: null, state: "finished", userId },
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("skips the latest cycle when its book holds no quote", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const quoted = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(6),
      quoteTexts: ["Fear is the mind-killer", "The spice must flow"],
      title: "Dune",
      userId,
    });
    await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(2),
      quoteTexts: [],
      title: "Messiah",
      userId,
    });

    const postFinish = await postFinishOf(accessToken);

    expectSelected(postFinish);
    expect(postFinish.readingCycleId).toBe(quoted.readingCycleId);
    expect(postFinish.quotesCount).toBe(2);
  });

  it("breaks a tie on the same finished date by the smaller cycle id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(4),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    const second = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(4),
      quoteTexts: ["The spice must flow"],
      title: "Messiah",
      userId,
    });
    const expectedId = [first.readingCycleId, second.readingCycleId].sort()[0];

    const postFinish = await postFinishOf(accessToken);

    expectSelected(postFinish);
    expect(postFinish.readingCycleId).toBe(expectedId);
  });

  it("drops a cycle whose book was trashed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(3),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    await prisma.book.update({
      data: { deletedAt: new Date(), purgeAt: new Date() },
      where: { id: bookId },
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("drops a cycle once every quote of its book is trashed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(3),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    await prisma.quote.updateMany({
      data: { deletedAt: new Date(), purgeAt: new Date() },
      where: { bookId },
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("keeps another reader's finished book out of the recap", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedFinishedBook({
      accessToken: owner.accessToken,
      finishedIsoDate: daysAgo(1),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId: owner.userId,
    });
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    await expect(postFinishOf(stranger.accessToken)).resolves.toBeNull();
  });

  it("never reviews a cycle by reading the overview", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { readingCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(1),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });

    const first = await postFinishOf(accessToken);
    const second = await postFinishOf(accessToken);

    expect(first?.readingCycleId).toBe(readingCycleId);
    expect(second?.readingCycleId).toBe(readingCycleId);
    await expect(countReviews()).resolves.toBe(0);
  });
});

describe("POST /api/quotes/post-finish/review", () => {
  it("rejects an anonymous reader", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/quotes/post-finish/review")
      .send({ readingCycleId: UNKNOWN_CYCLE_ID });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("rejects a body that is not a reading cycle id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await review(accessToken, { readingCycleId: "not-a-uuid" });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("rejects a reading cycle nobody owns", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    await review(accessToken, { readingCycleId: UNKNOWN_CYCLE_ID }).expect(HttpStatus.NOT_FOUND);
    await expect(countReviews()).resolves.toBe(0);
  });

  it("rejects another reader's reading cycle", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { readingCycleId } = await seedFinishedBook({
      accessToken: owner.accessToken,
      finishedIsoDate: daysAgo(1),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId: owner.userId,
    });
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    await review(stranger.accessToken, { readingCycleId }).expect(HttpStatus.NOT_FOUND);
    await expect(countReviews()).resolves.toBe(0);
  });

  it("hides the recap after the review and stays idempotent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { readingCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(1),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });

    await review(accessToken, { readingCycleId }).expect(HttpStatus.NO_CONTENT);
    await review(accessToken, { readingCycleId }).expect(HttpStatus.NO_CONTENT);

    await expect(countReviews()).resolves.toBe(1);
    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });

  it("moves on to the next eligible cycle after the review", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const older = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(9),
      quoteTexts: ["The spice must flow"],
      title: "Messiah",
      userId,
    });
    const latest = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(2),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });

    await review(accessToken, { readingCycleId: latest.readingCycleId }).expect(
      HttpStatus.NO_CONTENT,
    );

    const postFinish = await postFinishOf(accessToken);
    expectSelected(postFinish);
    expect(postFinish.readingCycleId).toBe(older.readingCycleId);
  });

  it("reviews only the supplied cycle when a newer one exists for the same book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId, readingCycleId: oldCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(20),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    const newCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(1),
      userId,
    });

    await review(accessToken, { readingCycleId: oldCycleId }).expect(HttpStatus.NO_CONTENT);

    const postFinish = await postFinishOf(accessToken);
    expectSelected(postFinish);
    expect(postFinish.readingCycleId).toBe(newCycleId);
  });

  it("keeps a reread eligible through its own cycle", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId, readingCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(25),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    await review(accessToken, { readingCycleId }).expect(HttpStatus.NO_CONTENT);
    await expect(postFinishOf(accessToken)).resolves.toBeNull();

    const rereadCycleId = await insertFinishedReadingCycle(prisma, {
      bookId,
      finishedIsoDate: daysAgo(1),
      userId,
    });

    const postFinish = await postFinishOf(accessToken);
    expectSelected(postFinish);
    expect(postFinish.readingCycleId).toBe(rereadCycleId);
  });

  it("keeps the review attached to the cycle when its finished date is corrected", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { readingCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(20),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    await review(accessToken, { readingCycleId }).expect(HttpStatus.NO_CONTENT);

    await prisma.bookReadingCycle.update({
      data: { finishedAt: parseIsoDate(daysAgo(2)) },
      where: { id: readingCycleId },
    });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
    await expect(countReviews()).resolves.toBe(1);
  });

  it("keeps a reviewed cycle hidden after its book gains new quotes", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId, readingCycleId } = await seedFinishedBook({
      accessToken,
      finishedIsoDate: daysAgo(3),
      quoteTexts: ["Fear is the mind-killer"],
      title: "Dune",
      userId,
    });
    await review(accessToken, { readingCycleId }).expect(HttpStatus.NO_CONTENT);

    await addQuote({ accessToken, bookId, text: "A line written after the recap" });

    await expect(postFinishOf(accessToken)).resolves.toBeNull();
  });
});

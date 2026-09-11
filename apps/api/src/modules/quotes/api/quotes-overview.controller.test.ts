import type { QuotesOverviewView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { QuotesOverviewViewSchema } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QUOTE_PURGE_QUEUE_NAME } from "../domain/quote-purge.js";
import { QuotesModule } from "../quotes.module.js";

const ELIGIBLE_AGE_DAYS = 40;

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

async function addOldQuote({
  accessToken,
  ageDays = ELIGIBLE_AGE_DAYS,
  bookId,
  text,
  ...body
}: {
  accessToken: string;
  ageDays?: number;
  bookId: string;
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

  const quoteId: string = res.body.id;
  await prisma.quote.update({
    data: { createdAt: subDays(new Date(), ageDays) },
    where: { id: quoteId },
  });
  return quoteId;
}

async function countImpressions(): Promise<number> {
  return prisma.quoteRediscoveryImpression.count();
}

async function createBook(accessToken: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], title: "Dune" });
  if (res.status !== HttpStatus.CREATED) {
    throw new Error(`book creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

function impress(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/quotes/rediscovery/impression")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function overview(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/quotes/overview")
    .set("Authorization", `Bearer ${accessToken}`);
}

async function overviewBody(accessToken: string): Promise<QuotesOverviewView> {
  const res = await overview(accessToken);
  expect(res.status).toBe(HttpStatus.OK);
  return QuotesOverviewViewSchema.parse(res.body);
}

async function seedEligibleQuotes(accessToken: string, count: number): Promise<string[]> {
  const bookId = await createBook(accessToken);
  const quoteIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    quoteIds.push(
      await addOldQuote({ accessToken, bookId, text: `Remembered line number ${index}` }),
    );
  }
  return quoteIds;
}

describe("GET /api/quotes/overview", () => {
  it("rejects an anonymous reader", async () => {
    const res = await request(app.getHttpServer()).get("/api/quotes/overview");

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("returns no memory quote for an empty archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    await expect(overviewBody(accessToken)).resolves.toEqual({
      memoryQuote: null,
      postFinish: null,
    });
  });

  it("returns no memory quote while a single quote would repeat forever", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEligibleQuotes(accessToken, 1);

    await expect(overviewBody(accessToken)).resolves.toEqual({
      memoryQuote: null,
      postFinish: null,
    });
  });

  it("returns no memory quote while every quote is younger than the minimum age", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addOldQuote({ accessToken, ageDays: 29, bookId, text: "Too fresh to miss" });
    await addOldQuote({ accessToken, ageDays: 1, bookId, text: "Written yesterday" });

    await expect(overviewBody(accessToken)).resolves.toEqual({
      memoryQuote: null,
      postFinish: null,
    });
  });

  it("never rediscovers a spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addOldQuote({ accessToken, bookId, isSpoiler: true, text: "The traitor is revealed" });
    await addOldQuote({
      accessToken,
      bookId,
      isFavorite: true,
      isSpoiler: true,
      text: "The ending in one line",
    });

    await expect(overviewBody(accessToken)).resolves.toEqual({
      memoryQuote: null,
      postFinish: null,
    });
  });

  it("serves the canonical quote view of an older quote", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const quoteIds = await seedEligibleQuotes(accessToken, 3);

    const { memoryQuote } = await overviewBody(accessToken);

    expect(memoryQuote).not.toBeNull();
    expect(quoteIds).toContain(memoryQuote?.id);
    expect(memoryQuote?.book).toMatchObject({ firstAuthorName: "Frank Herbert", title: "Dune" });
    expect(memoryQuote?.isSpoiler).toBe(false);
  });

  it("repeats the same choice and writes nothing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedEligibleQuotes(accessToken, 5);

    const first = await overviewBody(accessToken);
    const second = await overviewBody(accessToken);

    expect(first.memoryQuote?.id).toBe(second.memoryQuote?.id);
    await expect(countImpressions()).resolves.toBe(0);
  });

  it("stops rediscovering a quote once it is trashed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const quoteIds = await seedEligibleQuotes(accessToken, 3);
    const { memoryQuote } = await overviewBody(accessToken);
    await prisma.quote.update({
      data: { deletedAt: new Date(), purgeAt: new Date() },
      where: { id: memoryQuote?.id },
    });

    const replacement = await overviewBody(accessToken);

    expect(replacement.memoryQuote?.id).not.toBe(memoryQuote?.id);
    expect(quoteIds).toContain(replacement.memoryQuote?.id);
  });

  it("stops rediscovering the quotes of a trashed book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await addOldQuote({ accessToken, bookId, text: "First remembered line" });
    await addOldQuote({ accessToken, bookId, text: "Second remembered line" });
    await prisma.book.update({
      data: { deletedAt: new Date(), purgeAt: new Date() },
      where: { id: bookId },
    });

    await expect(overviewBody(accessToken)).resolves.toEqual({
      memoryQuote: null,
      postFinish: null,
    });
  });

  it("keeps another reader's archive out of the selection", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedEligibleQuotes(owner.accessToken, 4);
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    await expect(overviewBody(stranger.accessToken)).resolves.toEqual({
      memoryQuote: null,
      postFinish: null,
    });
  });

  it("serves the impressed quote of the day after the impression", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const quoteIds = await seedEligibleQuotes(accessToken, 4);
    const { memoryQuote } = await overviewBody(accessToken);
    const otherQuoteId = quoteIds.find((quoteId) => quoteId !== memoryQuote?.id);

    await impress(accessToken, { quoteId: otherQuoteId }).expect(HttpStatus.NO_CONTENT);

    const afterImpression = await overviewBody(accessToken);
    expect(afterImpression.memoryQuote?.id).toBe(otherQuoteId);
  });

  it("replaces an impressed quote that became a spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const quoteIds = await seedEligibleQuotes(accessToken, 4);
    const { memoryQuote } = await overviewBody(accessToken);
    await impress(accessToken, { quoteId: memoryQuote?.id }).expect(HttpStatus.NO_CONTENT);
    await prisma.quote.update({ data: { isSpoiler: true }, where: { id: memoryQuote?.id } });

    const replacement = await overviewBody(accessToken);

    expect(replacement.memoryQuote?.id).not.toBe(memoryQuote?.id);
    expect(quoteIds).toContain(replacement.memoryQuote?.id);
  });
});

describe("POST /api/quotes/rediscovery/impression", () => {
  it("rejects an anonymous reader", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/quotes/rediscovery/impression")
      .send({ quoteId: "11111111-1111-4111-8111-111111111111" });

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("rejects a body that is not a quote id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await impress(accessToken, { quoteId: "not-a-uuid" });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });

  it("records one row and stays idempotent for the same day", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const [quoteId] = await seedEligibleQuotes(accessToken, 2);

    await impress(accessToken, { quoteId }).expect(HttpStatus.NO_CONTENT);
    await impress(accessToken, { quoteId }).expect(HttpStatus.NO_CONTENT);

    await expect(countImpressions()).resolves.toBe(1);
  });

  it("refuses a quote that is still too young", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const quoteId = await addOldQuote({ accessToken, ageDays: 3, bookId, text: "Fresh ink" });

    await impress(accessToken, { quoteId }).expect(HttpStatus.NOT_FOUND);
    await expect(countImpressions()).resolves.toBe(0);
  });

  it("refuses a quote that became a spoiler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const [quoteId] = await seedEligibleQuotes(accessToken, 2);
    await prisma.quote.update({ data: { isSpoiler: true }, where: { id: quoteId } });

    await impress(accessToken, { quoteId }).expect(HttpStatus.NOT_FOUND);
    await expect(countImpressions()).resolves.toBe(0);
  });

  it("refuses another reader's quote", async () => {
    const owner = await context.registerVerifyAndLogin();
    const [quoteId] = await seedEligibleQuotes(owner.accessToken, 2);
    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });

    await impress(stranger.accessToken, { quoteId }).expect(HttpStatus.NOT_FOUND);
    await expect(countImpressions()).resolves.toBe(0);
  });
});

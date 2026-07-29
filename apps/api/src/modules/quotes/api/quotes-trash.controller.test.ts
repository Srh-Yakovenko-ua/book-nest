import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { QuoteLifecycleService } from "../application/quote-lifecycle.service.js";
import type { QuotePurgeReconciler } from "../application/quote-purge.reconciler.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QUOTE_PURGE_QUEUE_NAME } from "../domain/quote-purge.js";
import { QuotesModule } from "../quotes.module.js";

const addCalls: { data: unknown; opts: unknown }[] = [];
const removeCalls: string[] = [];

const queueStub = {
  add: (_name: string, data: unknown, opts: unknown): Promise<void> => {
    addCalls.push({ data, opts });
    return Promise.resolve();
  },
  remove: (jobId: string): Promise<void> => {
    removeCalls.push(jobId);
    return Promise.resolve();
  },
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let lifecycleService: QuoteLifecycleService;
let reconciler: QuotePurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, QuotesModule, BooksModule],
    [{ provide: getQueueToken(QUOTE_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  const lifecycleModule = await import("../application/quote-lifecycle.service.js");
  const reconcilerModule = await import("../application/quote-purge.reconciler.js");
  lifecycleService = app.get(lifecycleModule.QuoteLifecycleService);
  reconciler = app.get(reconcilerModule.QuotePurgeReconciler);
});

beforeEach(() => {
  context.reset();
  addCalls.length = 0;
  removeCalls.length = 0;
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

async function backdateDeletion(quoteId: string, days: number): Promise<void> {
  await prisma.quote.update({
    data: { deletedAt: subDays(new Date(), days) },
    where: { id: quoteId },
  });
}

async function createBookWithQuote(
  token: string,
  text: string,
): Promise<{ bookId: string; quoteId: string }> {
  const book = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
  });
  expect(book.status).toBe(HttpStatus.CREATED);
  const quote = await authed("post", `/api/books/${book.body.id}/quotes`, token).send({ text });
  expect(quote.status).toBe(HttpStatus.CREATED);
  return { bookId: book.body.id, quoteId: quote.body.id };
}

describe("quote trash", () => {
  it("moves the quote to the trash and schedules its purge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, quoteId } = await createBookWithQuote(accessToken, "Fear is the mind-killer");

    const res = await authed("delete", `/api/books/${bookId}/quotes/${quoteId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.quoteId).toBe(quoteId);
    expect(new Date(res.body.purgeAt)).toEqual(
      TRASH_RETENTION.purgeAfter(new Date(res.body.deletedAt)),
    );
    expect(addCalls[0]).toMatchObject({
      data: { quoteId },
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: quoteId },
    });
  });

  it("lists the trashed quote with its book title and keeps it out of the archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, quoteId } = await createBookWithQuote(accessToken, "Gone for now");

    await authed("delete", `/api/books/${bookId}/quotes/${quoteId}`, accessToken).expect(
      HttpStatus.OK,
    );

    const trash = await authed("get", "/api/quotes/trash", accessToken);
    expect(trash.body.totalCount).toBe(1);
    expect(trash.body.items[0]).toMatchObject({
      bookTitle: "Dune",
      id: quoteId,
      text: "Gone for now",
    });

    const archive = await authed("get", "/api/quotes", accessToken);
    expect(archive.body.totalCount).toBe(0);

    const summary = await authed("get", "/api/quotes/summary", accessToken);
    expect(summary.body.totalCount).toBe(0);
  });

  it("restores the quote back into the archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, quoteId } = await createBookWithQuote(accessToken, "Back soon");

    await authed("delete", `/api/books/${bookId}/quotes/${quoteId}`, accessToken).expect(
      HttpStatus.OK,
    );
    removeCalls.length = 0;

    const res = await authed("post", `/api/books/${bookId}/quotes/${quoteId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    expect(removeCalls).toEqual([quoteId]);

    const archive = await authed("get", "/api/quotes", accessToken);
    expect(archive.body.totalCount).toBe(1);
  });

  it("returns 404 restoring a quote that is not in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, quoteId } = await createBookWithQuote(accessToken, "Still here");

    const res = await authed("post", `/api/books/${bookId}/quotes/${quoteId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("purges an overdue quote and keeps a fresh one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const overdue = await createBookWithQuote(accessToken, "Overdue");
    const fresh = await createBookWithQuote(accessToken, "Fresh");

    await authed(
      "delete",
      `/api/books/${overdue.bookId}/quotes/${overdue.quoteId}`,
      accessToken,
    ).expect(HttpStatus.OK);
    await authed(
      "delete",
      `/api/books/${fresh.bookId}/quotes/${fresh.quoteId}`,
      accessToken,
    ).expect(HttpStatus.OK);
    await backdateDeletion(overdue.quoteId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ quoteId: overdue.quoteId, userId });
    await lifecycleService.purge({ quoteId: fresh.quoteId, userId });

    expect(await prisma.quote.findUnique({ where: { id: overdue.quoteId } })).toBeNull();
    expect(await prisma.quote.findUnique({ where: { id: fresh.quoteId } })).not.toBeNull();
  });

  it("reconciles overdue quotes the delayed job never fired for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, quoteId } = await createBookWithQuote(accessToken, "Swept");

    await authed("delete", `/api/books/${bookId}/quotes/${quoteId}`, accessToken).expect(
      HttpStatus.OK,
    );
    await backdateDeletion(quoteId, TRASH_RETENTION.days + 1);

    await reconciler.sweep();

    expect(await prisma.quote.findUnique({ where: { id: quoteId } })).toBeNull();
  });
});

describe("quote trash tenant isolation", () => {
  it("never leaks or restores another user trashed quote", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { bookId, quoteId } = await createBookWithQuote(owner.accessToken, "Private");
    await authed("delete", `/api/books/${bookId}/quotes/${quoteId}`, owner.accessToken).expect(
      HttpStatus.OK,
    );

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const listing = await authed("get", "/api/quotes/trash", stranger.accessToken);
    expect(listing.body.totalCount).toBe(0);

    const restore = await authed(
      "post",
      `/api/books/${bookId}/quotes/${quoteId}/restore`,
      stranger.accessToken,
    );
    expect(restore.status).toBe(HttpStatus.NOT_FOUND);
    expect(await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } })).toMatchObject({
      deletedAt: expect.any(Date),
    });
  });
});

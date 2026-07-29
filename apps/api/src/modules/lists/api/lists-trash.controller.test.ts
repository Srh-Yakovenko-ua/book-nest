import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { ListLifecycleService } from "../application/list-lifecycle.service.js";
import type { ListPurgeReconciler } from "../application/list-purge.reconciler.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { LIST_PURGE_QUEUE_NAME } from "../domain/list-purge.js";
import { ListsModule } from "../lists.module.js";

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
let lifecycleService: ListLifecycleService;
let reconciler: ListPurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, ListsModule, BooksModule],
    [{ provide: getQueueToken(LIST_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  const lifecycleModule = await import("../application/list-lifecycle.service.js");
  const reconcilerModule = await import("../application/list-purge.reconciler.js");
  lifecycleService = app.get(lifecycleModule.ListLifecycleService);
  reconciler = app.get(reconcilerModule.ListPurgeReconciler);
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

async function backdateDeletion(listId: string, days: number): Promise<void> {
  await prisma.bookList.update({
    data: { deletedAt: subDays(new Date(), days) },
    where: { id: listId },
  });
}

async function createListWithBook(
  token: string,
  name: string,
): Promise<{ bookId: string; listId: string }> {
  const list = await authed("post", "/api/lists", token).send({ name });
  expect(list.status).toBe(HttpStatus.CREATED);
  const book = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    listIds: [list.body.id],
    ownershipStatus: "owned",
    title: `${name} pick`,
  });
  expect(book.status).toBe(HttpStatus.CREATED);
  return { bookId: book.body.id, listId: list.body.id };
}

describe("DELETE /api/lists/:listId", () => {
  it("moves the list to the trash, keeps its memberships and schedules a purge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(accessToken, "Autumn");

    const res = await authed("delete", `/api/lists/${listId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.listId).toBe(listId);
    expect(new Date(res.body.purgeAt)).toEqual(
      TRASH_RETENTION.purgeAfter(new Date(res.body.deletedAt)),
    );
    expect(await prisma.bookListItem.count({ where: { listId } })).toBe(1);
    expect(addCalls[0]).toMatchObject({
      data: { listId },
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: listId },
    });
  });

  it("drops the list from the book it contained", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, listId } = await createListWithBook(accessToken, "Hidden");

    const before = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(before.body.lists).toHaveLength(1);

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);

    const after = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(after.body.lists).toEqual([]);

    const detail = await authed("get", `/api/lists/${listId}`, accessToken);
    expect(detail.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("frees the list name so the same title can be used again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(accessToken, "Reusable");

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);

    const recreated = await authed("post", "/api/lists", accessToken).send({ name: "Reusable" });

    expect(recreated.status).toBe(HttpStatus.CREATED);
    expect(recreated.body.id).not.toBe(listId);
  });
});

describe("GET /api/lists/trash", () => {
  it("lists trashed lists with their book count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(accessToken, "Trashed");

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("get", "/api/lists/trash", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({ bookCount: 1, id: listId, name: "Trashed" });
  });

  it("never leaks another user trash", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(owner.accessToken, "Private");
    await authed("delete", `/api/lists/${listId}`, owner.accessToken).expect(HttpStatus.OK);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", "/api/lists/trash", stranger.accessToken);

    expect(res.body.totalCount).toBe(0);
  });
});

describe("POST /api/lists/:listId/restore", () => {
  it("brings the list back with its books still in it", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId, listId } = await createListWithBook(accessToken, "Back");

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);
    removeCalls.length = 0;

    const res = await authed("post", `/api/lists/${listId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body).toMatchObject({ bookCount: 1, id: listId, name: "Back" });
    expect(removeCalls).toEqual([listId]);

    const book = await authed("get", `/api/books/${bookId}`, accessToken);
    expect(book.body.lists).toHaveLength(1);
    expect(await prisma.bookList.count({ where: { deletedAt: null, userId } })).toBe(1);
  });

  it("returns 404 for a list that is not in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(accessToken, "Active");

    const res = await authed("post", `/api/lists/${listId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("list purge", () => {
  it("deletes the list and its memberships once the window elapses", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookId, listId } = await createListWithBook(accessToken, "Doomed");

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(listId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ listId, userId });

    expect(await prisma.bookList.findUnique({ where: { id: listId } })).toBeNull();
    expect(await prisma.bookListItem.count({ where: { listId } })).toBe(0);
    expect(await prisma.book.findUnique({ where: { id: bookId } })).not.toBeNull();
  });

  it("keeps a list whose window has not elapsed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(accessToken, "Young");

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(listId, TRASH_RETENTION.days - 1);

    await lifecycleService.purge({ listId, userId });

    expect(await prisma.bookList.findUnique({ where: { id: listId } })).not.toBeNull();
  });

  it("reconciles overdue lists the delayed job never fired for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const overdue = await createListWithBook(accessToken, "Overdue");
    const fresh = await createListWithBook(accessToken, "Fresh");

    await authed("delete", `/api/lists/${overdue.listId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/lists/${fresh.listId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(overdue.listId, TRASH_RETENTION.days + 1);

    await reconciler.sweep();

    expect(await prisma.bookList.findUnique({ where: { id: overdue.listId } })).toBeNull();
    expect(await prisma.bookList.findUnique({ where: { id: fresh.listId } })).not.toBeNull();
  });
});

describe("restoring a list whose name was taken meanwhile", () => {
  it("returns 409 instead of failing on the partial unique index", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { listId } = await createListWithBook(accessToken, "Contested");

    await authed("delete", `/api/lists/${listId}`, accessToken).expect(HttpStatus.OK);
    await authed("post", "/api/lists", accessToken)
      .send({ name: "Contested" })
      .expect(HttpStatus.CREATED);

    const res = await authed("post", `/api/lists/${listId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.CONFLICT);
  });
});

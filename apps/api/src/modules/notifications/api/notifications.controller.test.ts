import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { NOTIFICATION_BOUNDS, REALTIME_CONTRACT } from "@app/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { BOOK_PURGE_QUEUE_NAME } from "../../books/domain/book-purge.js";
import { RealtimePort } from "../../realtime/index.js";
import { NOTIFICATION_EMAIL_QUEUE_NAME } from "../domain/notification-email.js";
import { NotificationsModule } from "../notifications.module.js";

type ListedNotification = {
  id: string;
  readAt: Nullable<string>;
};

type NotificationPage = {
  items: ListedNotification[];
  nextCursor: Nullable<string>;
};

type SeedNotificationInput = {
  createdAt?: Date;
  entityId?: Nullable<string>;
  entityType?: Nullable<string>;
  id?: string;
  params?: Prisma.InputJsonValue;
  readAt?: Nullable<Date>;
  reason?: string;
  type?: string;
  userId: string;
};

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

const realtimeStub = {
  emitToUser: vi.fn(),
  hasListeners: vi.fn().mockResolvedValue(true),
};

const INTERLOPER_CREATED_AT = new Date("2026-07-30T10:00:00.000Z");
const NEWEST_CREATED_AT = new Date("2026-07-30T09:00:00.000Z");
const OLDEST_CREATED_AT = new Date("2026-07-30T08:00:00.000Z");
const MAX_PAGES_READ = 10;
const LOWEST_TIED_ID = "00000000-0000-4000-8000-000000000001";
const HIGHEST_TIED_ID = "00000000-0000-4000-8000-000000000002";
const HIGHEST_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const SINGLE_ROW_PAGE_SIZE = 1;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, NotificationsModule, BooksModule],
    [
      { provide: getQueueToken(BOOK_PURGE_QUEUE_NAME), useValue: queueStub },
      { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE_NAME), useValue: queueStub },
      { provide: RealtimePort, useValue: realtimeStub },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  realtimeStub.emitToUser.mockClear();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

async function createBook(token: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

function pageIds(page: NotificationPage): string[] {
  return page.items.map((item) => item.id);
}

async function readEveryPage({
  accessToken,
  limit,
}: {
  accessToken: string;
  limit: number;
}): Promise<string[]> {
  const seen: string[] = [];
  let cursor: Nullable<string> = null;

  for (let page = 0; page < MAX_PAGES_READ; page += 1) {
    const current: NotificationPage = await readPage({ accessToken, cursor, limit });
    seen.push(...pageIds(current));
    cursor = current.nextCursor;
    if (cursor === null) {
      return seen;
    }
  }

  throw new Error("pagination never reached the end of the list");
}

async function readPage({
  accessToken,
  cursor,
  limit,
}: {
  accessToken: string;
  cursor: Nullable<string>;
  limit: number;
}): Promise<NotificationPage> {
  const cursorQuery = cursor === null ? "" : `&cursor=${cursor}`;
  const res = await authed("get", `/api/notifications?limit=${limit}${cursorQuery}`, accessToken);

  expect(res.status).toBe(HttpStatus.OK);
  return { items: res.body.items, nextCursor: res.body.nextCursor };
}

async function seedLoanNotification({
  bookId,
  userId,
}: {
  bookId: string;
  userId: string;
}): Promise<string> {
  return seedNotification({
    entityId: bookId,
    entityType: "book",
    params: {
      bookId,
      bookTitle: "Dune",
      dueDate: "2026-08-10",
      personName: "Olena",
    },
    reason: "loan_opt_in",
    type: "loan.due_soon",
    userId,
  });
}

async function seedNotification(input: SeedNotificationInput): Promise<string> {
  const row = await prisma.notification.create({
    data: {
      createdAt: input.createdAt ?? new Date(),
      dedupeKey: `seed:${randomUUID()}`,
      entityId: input.entityId ?? null,
      entityType: input.entityType ?? null,
      params: input.params ?? { requestedAt: new Date().toISOString() },
      readAt: input.readAt ?? null,
      reason: input.reason ?? "manual_test",
      type: input.type ?? "system.test",
      userId: input.userId,
      ...(input.id === undefined ? {} : { id: input.id }),
    },
    select: { id: true },
  });
  return row.id;
}

describe("GET /api/notifications", () => {
  it("returns the caller notifications newest first with the unread count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const older = await seedNotification({
      createdAt: new Date("2026-07-30T08:00:00.000Z"),
      userId,
    });
    const newer = await seedNotification({
      createdAt: new Date("2026-07-30T09:00:00.000Z"),
      userId,
    });

    const res = await authed("get", "/api/notifications", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.items.map((item: ListedNotification) => item.id)).toEqual([newer, older]);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items[0]).toMatchObject({
      entityState: null,
      level: "normal",
      readAt: null,
      reason: "manual_test",
    });
    expect(res.body.items[0].payload.type).toBe("system.test");
  });

  it("pages a tie group and an older row whose id is larger in the right order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedNotification({ createdAt: NEWEST_CREATED_AT, id: LOWEST_TIED_ID, userId });
    await seedNotification({ createdAt: NEWEST_CREATED_AT, id: HIGHEST_TIED_ID, userId });
    await seedNotification({ createdAt: OLDEST_CREATED_AT, id: HIGHEST_ID, userId });

    const seen = await readEveryPage({ accessToken, limit: SINGLE_ROW_PAGE_SIZE });

    expect(seen).toEqual([HIGHEST_TIED_ID, LOWEST_TIED_ID, HIGHEST_ID]);
  });

  it("never repeats a row when a newer notification arrives between two pages", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedNotification({ createdAt: NEWEST_CREATED_AT, id: LOWEST_TIED_ID, userId });
    await seedNotification({ createdAt: OLDEST_CREATED_AT, id: HIGHEST_ID, userId });

    const first = await readPage({ accessToken, cursor: null, limit: SINGLE_ROW_PAGE_SIZE });
    expect(pageIds(first)).toEqual([LOWEST_TIED_ID]);

    await seedNotification({ createdAt: INTERLOPER_CREATED_AT, userId });
    const second = await readPage({
      accessToken,
      cursor: first.nextCursor,
      limit: SINGLE_ROW_PAGE_SIZE,
    });

    expect(pageIds(second)).toEqual([HIGHEST_ID]);
  });

  it("filters to unread rows while the unread count stays global", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedNotification({ readAt: new Date("2026-07-30T09:00:00.000Z"), userId });
    await seedNotification({ userId });
    await seedNotification({ userId });

    const all = await authed("get", "/api/notifications", accessToken);
    const unread = await authed("get", "/api/notifications?unreadOnly=true", accessToken);

    expect(all.body.items).toHaveLength(3);
    expect(all.body.unreadCount).toBe(2);
    expect(unread.body.items).toHaveLength(2);
    expect(unread.body.unreadCount).toBe(2);
    expect(unread.body.items.every((item: ListedNotification) => item.readAt === null)).toBe(true);
  });

  it("drops a stored row whose params contradict its type and still serves the page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedNotification({ params: { nope: true }, type: "loan.due_soon", userId });
    const healthy = await seedNotification({ userId });

    const res = await authed("get", "/api/notifications", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.items.map((item: ListedNotification) => item.id)).toEqual([healthy]);
    expect(res.body.unreadCount).toBe(2);
  });

  it("never leaks another user notifications", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedNotification({ userId: owner.userId });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", "/api/notifications", stranger.accessToken);

    expect(res.body.items).toEqual([]);
    expect(res.body.unreadCount).toBe(0);
  });

  it("refuses a cursor that belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const foreignId = await seedNotification({ userId: owner.userId });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", `/api/notifications?cursor=${foreignId}`, stranger.accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("rejects a limit above the ceiling", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed(
      "get",
      `/api/notifications?limit=${NOTIFICATION_BOUNDS.listLimitMax + 1}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("agrees with the unread rows of the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedNotification({ readAt: new Date("2026-07-30T09:00:00.000Z"), userId });
    await seedNotification({ userId });

    const res = await authed("get", "/api/notifications/unread-count", accessToken);
    const list = await authed("get", "/api/notifications?unreadOnly=true", accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual({ unreadCount: 1 });
    expect(list.body.items).toHaveLength(1);
  });

  it("counts nothing for a user who owns no notification", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedNotification({ userId: owner.userId });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("get", "/api/notifications/unread-count", stranger.accessToken);

    expect(res.body).toEqual({ unreadCount: 0 });
  });
});

describe("POST /api/notifications/read", () => {
  it("marks the listed rows read and is idempotent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await seedNotification({ userId });
    await seedNotification({ userId });

    const initial = await authed("post", "/api/notifications/read", accessToken).send({
      ids: [first],
    });
    expect(initial.status).toBe(HttpStatus.NO_CONTENT);
    expect(initial.body).toEqual({});

    const afterFirst = await prisma.notification.findFirstOrThrow({ where: { id: first } });
    await authed("post", "/api/notifications/read", accessToken)
      .send({ ids: [first] })
      .expect(HttpStatus.NO_CONTENT);
    const afterSecond = await prisma.notification.findFirstOrThrow({ where: { id: first } });

    expect(afterSecond.readAt).toEqual(afterFirst.readAt);

    const count = await authed("get", "/api/notifications/unread-count", accessToken);
    expect(count.body.unreadCount).toBe(1);
  });

  it("pushes the decreased unread count to the caller socket", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await seedNotification({ userId });
    await seedNotification({ userId });

    await authed("post", "/api/notifications/read", accessToken)
      .send({ ids: [first] })
      .expect(HttpStatus.NO_CONTENT);

    expect(realtimeStub.emitToUser).toHaveBeenCalledWith({
      event: { type: REALTIME_CONTRACT.events.notificationsChanged, unreadCount: 1 },
      userId,
    });
  });

  it("cannot mark another user notification read", async () => {
    const owner = await context.registerVerifyAndLogin();
    const foreignId = await seedNotification({ userId: owner.userId });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await authed("post", "/api/notifications/read", stranger.accessToken).send({
      ids: [foreignId],
    });

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    const stillUnread = await prisma.notification.findFirstOrThrow({ where: { id: foreignId } });
    expect(stillUnread.readAt).toBeNull();
  });

  it("rejects one id more than the ceiling", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const ids = Array.from({ length: NOTIFICATION_BOUNDS.markReadMax + 1 }, () => randomUUID());

    const res = await authed("post", "/api/notifications/read", accessToken).send({ ids });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
  });
});

describe("POST /api/notifications/read-all", () => {
  it("clears the caller unread count only", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedNotification({ userId: owner.userId });
    await seedNotification({ userId: owner.userId });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerNotificationId = await seedNotification({ userId: stranger.userId });

    const res = await authed("post", "/api/notifications/read-all", owner.accessToken);

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    const ownerCount = await authed("get", "/api/notifications/unread-count", owner.accessToken);
    expect(ownerCount.body.unreadCount).toBe(0);

    const strangerRow = await prisma.notification.findFirstOrThrow({
      where: { id: strangerNotificationId },
    });
    expect(strangerRow.readAt).toBeNull();
  });

  it("pushes the cleared unread count to the caller socket only", async () => {
    const owner = await context.registerVerifyAndLogin();
    await seedNotification({ userId: owner.userId });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedNotification({ userId: stranger.userId });

    await authed("post", "/api/notifications/read-all", owner.accessToken).expect(
      HttpStatus.NO_CONTENT,
    );

    expect(realtimeStub.emitToUser).toHaveBeenCalledTimes(1);
    expect(realtimeStub.emitToUser).toHaveBeenCalledWith({
      event: { type: REALTIME_CONTRACT.events.notificationsChanged, unreadCount: 0 },
      userId: owner.userId,
    });
  });
});

describe("POST /api/notifications/test", () => {
  it("records a test notification and collapses repeats inside the same hour", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const first = await authed("post", "/api/notifications/test", accessToken);
    expect(first.status).toBe(HttpStatus.ACCEPTED);
    expect(first.body).toEqual({});

    await authed("post", "/api/notifications/test", accessToken).expect(HttpStatus.ACCEPTED);

    const res = await authed("get", "/api/notifications", accessToken);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      entityState: null,
      level: "normal",
      reason: "manual_test",
    });
    expect(res.body.items[0].payload.type).toBe("system.test");
    expect(typeof res.body.items[0].payload.requestedAt).toBe("string");
  });

  it("pushes the unread count so the button probes the whole pipeline", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    await authed("post", "/api/notifications/test", accessToken).expect(HttpStatus.ACCEPTED);

    expect(realtimeStub.emitToUser).toHaveBeenCalledWith({
      event: { type: REALTIME_CONTRACT.events.notificationsChanged, unreadCount: 1 },
      userId,
    });
  });

  it("brings the collapsed row back to unread when the caller presses test again", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await authed("post", "/api/notifications/test", accessToken).expect(HttpStatus.ACCEPTED);
    await authed("post", "/api/notifications/read-all", accessToken).expect(HttpStatus.NO_CONTENT);
    const afterRead = await authed("get", "/api/notifications/unread-count", accessToken);
    expect(afterRead.body.unreadCount).toBe(0);

    await authed("post", "/api/notifications/test", accessToken).expect(HttpStatus.ACCEPTED);

    const res = await authed("get", "/api/notifications", accessToken);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].readAt).toBeNull();
    expect(res.body.unreadCount).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });
});

describe("notification entity state", () => {
  it("tracks the book through live, trashed and gone while keeping the stored title", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    await seedLoanNotification({ bookId, userId });

    const live = await authed("get", "/api/notifications", accessToken);
    expect(live.body.items[0].entityState).toBe("live");
    expect(live.body.items[0].payload.bookTitle).toBe("Dune");

    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);
    const trashed = await authed("get", "/api/notifications", accessToken);
    expect(trashed.body.items[0].entityState).toBe("trashed");
    expect(trashed.body.items[0].payload.bookTitle).toBe("Dune");

    await prisma.book.delete({ where: { id: bookId } });
    const gone = await authed("get", "/api/notifications", accessToken);
    expect(gone.body.items[0].entityState).toBe("gone");
    expect(gone.body.items[0].payload.bookTitle).toBe("Dune");
  });

  it("never resolves another user book as live", async () => {
    const owner = await context.registerVerifyAndLogin();
    const bookId = await createBook(owner.accessToken);
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedLoanNotification({ bookId, userId: stranger.userId });

    const res = await authed("get", "/api/notifications", stranger.accessToken);

    expect(res.body.items[0].entityState).toBe("gone");
  });
});

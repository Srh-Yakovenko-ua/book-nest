import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { NoteLifecycleService } from "../application/note-lifecycle.service.js";
import type { NotePurgeReconciler } from "../application/note-purge.reconciler.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { NOTE_PURGE_QUEUE_NAME } from "../domain/note-purge.js";
import { NotesModule } from "../notes.module.js";

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
let lifecycleService: NoteLifecycleService;
let reconciler: NotePurgeReconciler;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, NotesModule, SeriesModule, BooksModule],
    [{ provide: getQueueToken(NOTE_PURGE_QUEUE_NAME), useValue: queueStub }],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  const lifecycleModule = await import("../application/note-lifecycle.service.js");
  const reconcilerModule = await import("../application/note-purge.reconciler.js");
  lifecycleService = app.get(lifecycleModule.NoteLifecycleService);
  reconciler = app.get(reconcilerModule.NotePurgeReconciler);
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

async function backdateDeletion(noteId: string, days: number): Promise<void> {
  await prisma.note.update({
    data: TRASH_RETENTION.stamp(subDays(new Date(), days)),
    where: { id: noteId },
  });
}

async function createBookWithNote(
  token: string,
  text: string,
): Promise<{ bookId: string; noteId: string }> {
  const book = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
  });
  expect(book.status).toBe(HttpStatus.CREATED);
  const note = await authed("post", `/api/books/${book.body.id}/notes`, token).send({ text });
  expect(note.status).toBe(HttpStatus.CREATED);
  return { bookId: book.body.id, noteId: note.body.id };
}

describe("note trash", () => {
  it("moves the note to the trash and schedules its purge", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { noteId } = await createBookWithNote(accessToken, "A thought");

    const res = await authed("delete", `/api/notes/${noteId}`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.noteId).toBe(noteId);
    expect(new Date(res.body.purgeAt)).toEqual(
      TRASH_RETENTION.stamp(new Date(res.body.deletedAt)).purgeAt,
    );
    expect(addCalls[0]).toMatchObject({
      data: { noteId },
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: noteId },
    });
  });

  it("lists the trashed note with its entity title and keeps it out of the archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, noteId } = await createBookWithNote(accessToken, "Hidden thought");

    await authed("delete", `/api/notes/${noteId}`, accessToken).expect(HttpStatus.OK);

    const trash = await authed("get", "/api/notes/trash", accessToken);
    expect(trash.body.totalCount).toBe(1);
    expect(trash.body.items[0]).toMatchObject({
      entityTitle: "Dune",
      entityType: "book",
      id: noteId,
      text: "Hidden thought",
    });

    const archive = await authed("get", "/api/notes", accessToken);
    expect(archive.body.totalCount).toBe(0);

    const summary = await authed("get", "/api/notes/summary", accessToken);
    expect(summary.body.total).toBe(0);

    const perBook = await authed("get", `/api/books/${bookId}/notes`, accessToken);
    expect(perBook.body.notes).toEqual([]);
  });

  it("restores the note back into the archive", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { noteId } = await createBookWithNote(accessToken, "Back soon");

    await authed("delete", `/api/notes/${noteId}`, accessToken).expect(HttpStatus.OK);
    removeCalls.length = 0;

    const res = await authed("post", `/api/notes/${noteId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NO_CONTENT);
    expect(removeCalls).toEqual([noteId]);

    const archive = await authed("get", "/api/notes", accessToken);
    expect(archive.body.totalCount).toBe(1);
  });

  it("refuses to restore a note whose book is itself in the trash", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { bookId, noteId } = await createBookWithNote(accessToken, "Orphaned");

    await authed("delete", `/api/notes/${noteId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/books/${bookId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("post", `/api/notes/${noteId}/restore`, accessToken);

    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it("purges an overdue note and keeps a fresh one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const overdue = await createBookWithNote(accessToken, "Overdue");
    const fresh = await createBookWithNote(accessToken, "Fresh");

    await authed("delete", `/api/notes/${overdue.noteId}`, accessToken).expect(HttpStatus.OK);
    await authed("delete", `/api/notes/${fresh.noteId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(overdue.noteId, TRASH_RETENTION.days + 1);

    await lifecycleService.purge({ noteId: overdue.noteId, userId });
    await lifecycleService.purge({ noteId: fresh.noteId, userId });

    expect(await prisma.note.findUnique({ where: { id: overdue.noteId } })).toBeNull();
    expect(await prisma.note.findUnique({ where: { id: fresh.noteId } })).not.toBeNull();
  });

  it("reconciles overdue notes the delayed job never fired for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { noteId } = await createBookWithNote(accessToken, "Swept");

    await authed("delete", `/api/notes/${noteId}`, accessToken).expect(HttpStatus.OK);
    await backdateDeletion(noteId, TRASH_RETENTION.days + 1);

    await reconciler.sweep();

    expect(await prisma.note.findUnique({ where: { id: noteId } })).toBeNull();
  });
});

describe("note trash tenant isolation", () => {
  it("never leaks or restores another user trashed note", async () => {
    const owner = await context.registerVerifyAndLogin();
    const { noteId } = await createBookWithNote(owner.accessToken, "Private");
    await authed("delete", `/api/notes/${noteId}`, owner.accessToken).expect(HttpStatus.OK);

    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const listing = await authed("get", "/api/notes/trash", stranger.accessToken);
    expect(listing.body.totalCount).toBe(0);

    const restore = await authed("post", `/api/notes/${noteId}/restore`, stranger.accessToken);
    expect(restore.status).toBe(HttpStatus.NOT_FOUND);
    expect(await prisma.note.findUniqueOrThrow({ where: { id: noteId } })).toMatchObject({
      deletedAt: expect.any(Date),
    });
  });
});

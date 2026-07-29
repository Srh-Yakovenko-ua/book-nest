import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import { subDays } from "date-fns";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharacterLifecycleService } from "../application/character-lifecycle.service.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";

const MISSING_ID = "99999999-9999-4999-8999-999999999999";

const addCalls: { data: unknown; name: string; opts: unknown }[] = [];
const removeCalls: string[] = [];

const queueStub = {
  add: (name: string, data: unknown, opts: unknown): Promise<void> => {
    addCalls.push({ data, name, opts });
    return Promise.resolve();
  },
  remove: (jobId: string): Promise<void> => {
    removeCalls.push(jobId);
    return Promise.resolve();
  },
};

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let service: CharacterLifecycleService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, CharactersModule],
    [
      { provide: StoragePort, useValue: storageStub },
      { provide: getQueueToken(CHARACTER_PURGE_QUEUE_NAME), useValue: queueStub },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
  service = app.get(CharacterLifecycleService);
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

async function createBook(token: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title: "Dune",
    ...overrides,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

const bookProfile = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  importance: "central",
  ...overrides,
});

async function createNewInBook(
  token: string,
  bookId: string,
  character: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Promise<request.Response> {
  return authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: bookProfile(profile),
    character: { name: "Paul Atreides", ...character },
    mode: "new",
  });
}

async function createTag(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/tags", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function insertMedia(userId: string, kind = "avatar"): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 100,
      kind,
      sizeBytes: 1234,
      storageKey: `media/${kind}/${randomUUID()}/image.webp`,
      userId,
      width: 100,
    },
  });
  return asset.id;
}

describe("DELETE /api/characters/:characterId (soft delete)", () => {
  it("requires an explicit confirm=true flag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;

    const missing = await authed("delete", `/api/characters/${characterId}`, accessToken);
    expect(missing.status).toBe(HttpStatus.BAD_REQUEST);

    const falsy = await authed(
      "delete",
      `/api/characters/${characterId}?confirm=false`,
      accessToken,
    );
    expect(falsy.status).toBe(HttpStatus.BAD_REQUEST);

    const confirmed = await authed(
      "delete",
      `/api/characters/${characterId}?confirm=true`,
      accessToken,
    );
    expect(confirmed.status).toBe(HttpStatus.OK);
  });

  it("hides the character from every read context and enqueues a delayed purge job", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(accessToken, bookId, { name: "Paul Atreides" });
    const characterId = created.body.id;

    const deleted = await authed(
      "delete",
      `/api/characters/${characterId}?confirm=true`,
      accessToken,
    );
    expect(deleted.status).toBe(HttpStatus.OK);
    expect(deleted.body).toMatchObject({ characterId });
    expect(typeof deleted.body.deletedAt).toBe("string");
    expect(typeof deleted.body.purgeAt).toBe("string");

    const stored = await prisma.character.findUnique({ where: { id: characterId } });
    expect(stored?.deletedAt).not.toBeNull();

    const globalDetails = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(globalDetails.status).toBe(HttpStatus.NOT_FOUND);

    const combined = await authed(
      "get",
      `/api/books/${bookId}/characters/${characterId}`,
      accessToken,
    );
    expect(combined.status).toBe(HttpStatus.NOT_FOUND);

    const roster = await authed("get", `/api/books/${bookId}/characters`, accessToken);
    expect(roster.status).toBe(HttpStatus.OK);
    expect(roster.body.totalCount).toBe(0);
    expect(roster.body.items).toHaveLength(0);

    expect(addCalls).toHaveLength(1);
    expect(addCalls[0]).toMatchObject({
      data: { characterId, userId },
      name: "character-purge",
      opts: { delay: TRASH_RETENTION.purgeDelayMs, jobId: characterId },
    });
  });

  it("returns 404 when deleting an already soft-deleted character", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;

    await authed("delete", `/api/characters/${characterId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );

    const again = await authed(
      "delete",
      `/api/characters/${characterId}?confirm=true`,
      accessToken,
    );
    expect(again.status).toBe(HttpStatus.NOT_FOUND);
    expect(again.body.code).toBe("character_not_found");
  });

  it("returns 404 for a foreign character without leaking existence", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const created = await authed("post", "/api/characters", owner.accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;

    const foreign = await authed(
      "delete",
      `/api/characters/${characterId}?confirm=true`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);
    expect(addCalls).toHaveLength(0);
  });
});

describe("POST /api/characters/:characterId/restore", () => {
  it("clears the soft-delete, restores full state and cancels the queued purge job", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(
      accessToken,
      bookId,
      { aliases: [{ name: "Usul", type: "nickname" }], name: "Paul Atreides" },
      { roles: [{ roleType: "protagonist" }, { roleType: "supporting" }] },
    );
    const characterId = created.body.id;
    const tagId = await createTag(accessToken, "Hero");
    await authed("patch", `/api/books/${bookId}/characters/${characterId}`, accessToken).send({
      tagIds: [tagId],
    });

    await authed("delete", `/api/characters/${characterId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );
    removeCalls.length = 0;

    const restored = await authed("post", `/api/characters/${characterId}/restore`, accessToken);
    expect(restored.status).toBe(HttpStatus.OK);
    expect(restored.body.id).toBe(characterId);
    expect(restored.body.appearances).toHaveLength(1);
    expect(restored.body.appearances[0].roles).toHaveLength(2);
    const globalAliases = restored.body.aliases.filter(
      (alias: { bookId: null | string }) => alias.bookId === null,
    );
    expect(globalAliases).toHaveLength(1);
    expect(globalAliases[0].name).toBe("Usul");

    expect(removeCalls).toEqual([characterId]);
    expect(await prisma.characterTag.count({ where: { characterId } })).toBe(1);

    const readBack = await authed("get", `/api/characters/${characterId}`, accessToken);
    expect(readBack.status).toBe(HttpStatus.OK);
  });

  it("returns 404 for a character that is not soft-deleted, foreign or missing", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const created = await authed("post", "/api/characters", owner.accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;

    const notDeleted = await authed(
      "post",
      `/api/characters/${characterId}/restore`,
      owner.accessToken,
    );
    expect(notDeleted.status).toBe(HttpStatus.NOT_FOUND);

    await authed("delete", `/api/characters/${characterId}?confirm=true`, owner.accessToken).expect(
      HttpStatus.OK,
    );
    const foreign = await authed(
      "post",
      `/api/characters/${characterId}/restore`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "post",
      `/api/characters/${MISSING_ID}/restore`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe("GET /api/characters/:characterId/deletion-preview", () => {
  it("returns impact counts without any character field values", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(
      accessToken,
      bookId,
      { aliases: [{ name: "Usul", type: "nickname" }], name: "Paul Atreides" },
      { roles: [{ roleType: "protagonist" }, { roleType: "supporting" }] },
    );
    const characterId = created.body.id;
    const tagId = await createTag(accessToken, "Hero");
    await authed("patch", `/api/books/${bookId}/characters/${characterId}`, accessToken).send({
      tagIds: [tagId],
    });

    const preview = await authed(
      "get",
      `/api/characters/${characterId}/deletion-preview`,
      accessToken,
    );
    expect(preview.status).toBe(HttpStatus.OK);
    expect(preview.body).toEqual({
      aliasCount: 1,
      appearanceCount: 1,
      roleCount: 2,
      tagCount: 1,
    });
    expect(Object.keys(preview.body).sort()).toEqual([
      "aliasCount",
      "appearanceCount",
      "roleCount",
      "tagCount",
    ]);
    expect(JSON.stringify(preview.body)).not.toContain("Paul Atreides");
    expect(JSON.stringify(preview.body)).not.toContain("Usul");
  });

  it("returns 404 for a foreign or missing character", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const created = await authed("post", "/api/characters", owner.accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;

    const foreign = await authed(
      "get",
      `/api/characters/${characterId}/deletion-preview`,
      intruder.accessToken,
    );
    expect(foreign.status).toBe(HttpStatus.NOT_FOUND);

    const missing = await authed(
      "get",
      `/api/characters/${MISSING_ID}/deletion-preview`,
      owner.accessToken,
    );
    expect(missing.status).toBe(HttpStatus.NOT_FOUND);
  });
});

async function backdatePurgeWindow(characterId: string): Promise<void> {
  await prisma.character.update({
    data: { deletedAt: subDays(new Date(), TRASH_RETENTION.days + 1) },
    where: { id: characterId },
  });
}

describe("character purge", () => {
  it("physically deletes a soft-deleted character and cascades its book links", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const created = await createNewInBook(
      accessToken,
      bookId,
      { name: "Paul Atreides" },
      { roles: [{ roleType: "protagonist" }] },
    );
    const characterId = created.body.id;
    await authed("delete", `/api/characters/${characterId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );
    await backdatePurgeWindow(characterId);

    await service.purge({ characterId, userId });

    expect(await prisma.character.count({ where: { id: characterId } })).toBe(0);
    expect(await prisma.bookCharacter.count({ where: { characterId } })).toBe(0);
    expect(
      await prisma.bookCharacterRole.count({ where: { bookCharacter: { characterId } } }),
    ).toBe(0);
  });

  it("is a no-op when the character was restored before the purge runs", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;
    await authed("delete", `/api/characters/${characterId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );
    await authed("post", `/api/characters/${characterId}/restore`, accessToken).expect(
      HttpStatus.OK,
    );

    await service.purge({ characterId, userId });

    expect(await prisma.character.count({ where: { id: characterId } })).toBe(1);
  });

  it("keeps a soft-deleted character whose grace window has not elapsed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const created = await authed("post", "/api/characters", accessToken).send({
      character: { name: "Paul Atreides" },
    });
    const characterId = created.body.id;
    await authed("delete", `/api/characters/${characterId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );

    await service.purge({ characterId, userId });

    expect(await prisma.character.count({ where: { id: characterId } })).toBe(1);
  });

  it("deletes orphaned media but keeps media still referenced elsewhere", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(accessToken);
    const orphanMediaId = await insertMedia(userId, "avatar");
    const sharedMediaId = await insertMedia(userId, "avatar");

    const created = await authed("post", "/api/characters", accessToken).send({
      character: { avatarMediaId: orphanMediaId, name: "Paul Atreides" },
      firstAppearance: { bookId, bookProfile: bookProfile({ portraitMediaId: sharedMediaId }) },
    });
    expect(created.status).toBe(HttpStatus.CREATED);
    const characterId = created.body.id;

    const keeper = await authed("post", "/api/characters", accessToken).send({
      character: { avatarMediaId: sharedMediaId, name: "Chani" },
    });
    expect(keeper.status).toBe(HttpStatus.CREATED);

    await authed("delete", `/api/characters/${characterId}?confirm=true`, accessToken).expect(
      HttpStatus.OK,
    );
    await backdatePurgeWindow(characterId);

    await service.purge({ characterId, userId });

    expect(await prisma.character.count({ where: { id: characterId } })).toBe(0);
    expect(await prisma.mediaAsset.count({ where: { id: orphanMediaId } })).toBe(0);
    expect(await prisma.mediaAsset.count({ where: { id: sharedMediaId } })).toBe(1);
  });
});

import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";
import { CharacterPortabilityRepository } from "../infrastructure/character-portability.repository.js";

const queueStub = {
  add: (): Promise<void> => Promise.resolve(),
  remove: (): Promise<void> => Promise.resolve(),
};

const storageStub = {
  delete: (): Promise<void> => Promise.resolve(),
  get: (): Promise<Buffer> => Promise.resolve(Buffer.alloc(0)),
  publicUrl: (key: string): string => `http://test.local/${key}`,
  put: (): Promise<void> => Promise.resolve(),
};

const ZERO_SKIPPED = {
  aliasesMissingBook: 0,
  appearancesMissingBook: 0,
  bookStatesMissingBook: 0,
  membershipsMissingBook: 0,
  relationshipsInvalid: 0,
  tagsMissing: 0,
  theoriesWithoutTarget: 0,
  unlinkedMedia: 0,
  unlinkedSeries: 0,
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

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
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  vi.restoreAllMocks();
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

async function buildGraph(token: string): Promise<void> {
  const book1 = await createBook(token, "Dune");
  const book2 = await createBook(token, "Dune Messiah");
  const survivor = await createCharacter(token, {
    aliases: [{ name: "Muad'Dib", type: "nickname" }],
    name: "Paul",
  });
  const chani = await createCharacter(token, { name: "Chani" });

  await linkToBook(token, book1, survivor, {
    importance: "central",
    roles: [{ roleType: "protagonist" }],
  });
  await linkToBook(token, book2, survivor, { importance: "major" });

  const tagRes = await authed("post", "/api/tags", token).send({ name: "Hero" });
  expect(tagRes.status).toBe(HttpStatus.CREATED);
  await authed("patch", `/api/books/${book1}/characters/${survivor}`, token)
    .send({ tagIds: [tagRes.body.id] })
    .expect(HttpStatus.OK);

  await authed("post", "/api/character-groups", token)
    .send({
      members: [{ characterId: survivor }, { characterId: chani }],
      name: "House Atreides",
      type: "house",
    })
    .expect(HttpStatus.CREATED);

  await authed("post", "/api/character-relationships", token)
    .send({
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: survivor,
      targetCharacterId: chani,
      type: "friend_of",
    })
    .expect(HttpStatus.CREATED);

  await authed("post", "/api/character-theories", token)
    .send({ characterId: survivor, text: "Paul becomes the Kwisatz Haderach" })
    .expect(HttpStatus.CREATED);
}

async function createBook(token: string, title: string): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createCharacter(token: string, character: Record<string, unknown>): Promise<string> {
  const res = await authed("post", "/api/characters", token).send({ character });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function exportBundle(token: string): Promise<Record<string, unknown>> {
  const res = await authed("get", "/api/characters/export", token);
  expect(res.status).toBe(HttpStatus.OK);
  return res.body;
}

async function linkToBook(
  token: string,
  bookId: string,
  characterId: string,
  bookProfile: Record<string, unknown>,
): Promise<void> {
  const res = await authed("post", `/api/books/${bookId}/characters`, token).send({
    bookProfile: { importance: "supporting", ...bookProfile },
    characterId,
    mode: "existing",
  });
  expect(res.status).toBe(HttpStatus.CREATED);
}

const EXPECTED_FULL_CREATED = {
  aliases: 1,
  appearances: 2,
  bookStates: 0,
  characters: 2,
  groups: 1,
  memberships: 2,
  relationships: 1,
  roles: 1,
  tags: 1,
  theories: 1,
};

describe("GET /api/characters/export", () => {
  it("exports the caller's full character graph and stays owner-scoped", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);

    const bundle = await exportBundle(accessToken);
    expect(bundle.formatVersion).toBe(1);
    expect(typeof bundle.exportedAt).toBe("string");
    expect(Array.isArray(bundle.characters)).toBe(true);
    expect((bundle.characters as unknown[]).length).toBe(2);
    expect((bundle.groups as unknown[]).length).toBe(1);
    expect((bundle.relationships as unknown[]).length).toBe(1);
    expect((bundle.theories as unknown[]).length).toBe(1);

    const stranger = await context.registerVerifyAndLogin({ email: "stranger@example.com" });
    const empty = await exportBundle(stranger.accessToken);
    expect(empty.characters).toEqual([]);
    expect(empty.groups).toEqual([]);
    expect(empty.relationships).toEqual([]);
    expect(empty.theories).toEqual([]);
  });
});

describe("POST /api/characters/import", () => {
  it("round-trips the caller's own bundle with fresh ids and full re-linking", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);
    const bundle = await exportBundle(accessToken);

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.formatVersion).toBe(1);
    expect(res.body.created).toEqual(EXPECTED_FULL_CREATED);
    expect(res.body.skipped).toEqual(ZERO_SKIPPED);

    expect(await prisma.character.count({ where: { userId } })).toBe(4);
    expect(await prisma.characterRelationship.count({ where: { userId } })).toBe(2);
    expect(await prisma.characterGroup.count({ where: { userId } })).toBe(2);
    expect(await prisma.characterTheory.count({ where: { userId } })).toBe(2);
    expect(await prisma.bookCharacter.count({ where: { character: { userId } } })).toBe(4);
  });

  it("stamps ownership on the importer and skips library refs it does not own", async () => {
    const owner = await context.registerVerifyAndLogin();
    await buildGraph(owner.accessToken);
    const bundle = await exportBundle(owner.accessToken);

    const importer = await context.registerVerifyAndLogin({ email: "importer@example.com" });
    const res = await authed("post", "/api/characters/import", importer.accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.OK);

    expect(res.body.created).toEqual({
      aliases: 1,
      appearances: 0,
      bookStates: 0,
      characters: 2,
      groups: 1,
      memberships: 2,
      relationships: 1,
      roles: 0,
      tags: 0,
      theories: 1,
    });
    expect(res.body.skipped.appearancesMissingBook).toBe(2);
    expect(res.body.skipped.tagsMissing).toBe(1);

    const importerCharacters = await prisma.character.findMany({
      select: { userId: true },
      where: { userId: importer.userId },
    });
    expect(importerCharacters.length).toBe(2);
    expect(importerCharacters.every((row) => row.userId === importer.userId)).toBe(true);
    expect(await prisma.character.count({ where: { userId: owner.userId } })).toBe(2);
    expect(await prisma.characterRelationship.count({ where: { userId: importer.userId } })).toBe(
      1,
    );
    expect(
      await prisma.bookCharacter.count({ where: { character: { userId: importer.userId } } }),
    ).toBe(0);
  });

  it("rejects an over-limit bundle with 422", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);
    const bundle = await exportBundle(accessToken);
    const characters = bundle.characters as { aliases: unknown[] }[];
    const firstCharacter = characters[0];
    if (firstCharacter !== undefined) {
      firstCharacter.aliases = Array.from({ length: 31 }, (_unused, index) => ({
        bookId: null,
        isSpoiler: false,
        name: `Alias ${index}`,
        position: index,
        type: "nickname",
      }));
    }

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_too_large");
  });

  it("rejects a malformed bundle with 422", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("post", "/api/characters/import", accessToken).send({
      characters: "not-an-array",
      exportedAt: "2026-01-01T00:00:00.000Z",
      formatVersion: 1,
      groups: [],
      relationships: [],
      theories: [],
    });
    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.body.code).toBe("character_import_invalid");
  });

  it("rolls the whole import back when insertion fails midway", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await buildGraph(accessToken);
    const bundle = await exportBundle(accessToken);

    const repository = app.get(CharacterPortabilityRepository);
    const realInsert = CharacterPortabilityRepository.prototype.insertGraph;
    vi.spyOn(repository, "insertGraph").mockImplementation(async (plan, client) => {
      await realInsert.call(repository, plan, client);
      throw new Error("boom");
    });

    const res = await authed("post", "/api/characters/import", accessToken).send(bundle);
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(await prisma.character.count({ where: { userId } })).toBe(2);
  });
});

describe("character portability — whole-profile hidden characters", () => {
  it("preserves hideProfileAsSpoiler across an export and import round-trip", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createCharacter(owner.accessToken, { hideProfileAsSpoiler: true, name: "The Ghost" });

    const bundle = await exportBundle(owner.accessToken);
    const exported = bundle.characters as { hideProfileAsSpoiler: boolean; name: string }[];
    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({ hideProfileAsSpoiler: true, name: "The Ghost" });

    const importer = await context.registerVerifyAndLogin({ email: "importer@example.com" });
    const imported = await authed("post", "/api/characters/import", importer.accessToken).send(
      bundle,
    );
    expect(imported.status).toBe(HttpStatus.OK);

    const listDefault = await authed("get", "/api/characters", importer.accessToken);
    expect(listDefault.body.items).toEqual([]);

    const listRevealed = await authed(
      "get",
      "/api/characters?includeHiddenProfiles=true",
      importer.accessToken,
    );
    expect(listRevealed.body.items).toHaveLength(1);
    expect(listRevealed.body.items[0]).toMatchObject({
      hideProfileAsSpoiler: true,
      name: "The Ghost",
    });
  });
});

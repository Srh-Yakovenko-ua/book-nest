import type { INestApplication } from "@nestjs/common";

import { getQueueToken } from "@nestjs/bullmq";
import { HttpStatus } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { StoragePort } from "../../media/domain/storage.port.js";
import { CharactersModule } from "../characters.module.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "../domain/character-purge.js";

const MISSING_ID = "99999999-9999-4999-8999-999999999999";

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

async function createRelationship(token: string, body: Record<string, unknown>): Promise<void> {
  const res = await authed("post", "/api/character-relationships", token).send(body);
  expect(res.status).toBe(HttpStatus.CREATED);
}

async function createTag(token: string, name: string): Promise<string> {
  const res = await authed("post", "/api/tags", token).send({ name });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
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

describe("POST /api/characters/:characterId/merge", () => {
  it("re-points every reference table, resolves each conflict, and deletes the loser", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book1 = await createBook(accessToken, "Dune");
    const book2 = await createBook(accessToken, "Dune Messiah");
    const book3 = await createBook(accessToken, "Children of Dune");

    const survivor = await createCharacter(accessToken, {
      aliases: [{ name: "Muad'Dib", type: "nickname" }],
      name: "Survivor",
    });
    const loser = await createCharacter(accessToken, {
      aliases: [
        { name: "Muad'Dib", type: "nickname" },
        { name: "Usul", type: "nickname" },
      ],
      name: "Loser",
    });
    const third = await createCharacter(accessToken, { name: "Third" });
    const fourth = await createCharacter(accessToken, { name: "Fourth" });

    await linkToBook(accessToken, book1, survivor, { importance: "central" });
    await linkToBook(accessToken, book2, survivor, { importance: "major" });
    await linkToBook(accessToken, book2, loser, {
      importance: "major",
      roles: [{ roleType: "protagonist" }, { roleType: "supporting" }],
    });
    await linkToBook(accessToken, book3, loser, {
      importance: "central",
      roles: [{ roleType: "protagonist" }],
    });

    const heroTag = await createTag(accessToken, "Hero");
    const villainTag = await createTag(accessToken, "Villain");
    await authed("patch", `/api/books/${book1}/characters/${survivor}`, accessToken)
      .send({ tagIds: [heroTag] })
      .expect(HttpStatus.OK);
    await authed("patch", `/api/books/${book3}/characters/${loser}`, accessToken)
      .send({ tagIds: [heroTag, villainTag] })
      .expect(HttpStatus.OK);

    await authed("post", "/api/character-groups", accessToken)
      .send({
        members: [{ characterId: survivor }, { characterId: loser }],
        name: "Shared Group",
        type: "house",
      })
      .expect(HttpStatus.CREATED);
    await authed("post", "/api/character-groups", accessToken)
      .send({ members: [{ characterId: loser }], name: "Solo Group", type: "order" })
      .expect(HttpStatus.CREATED);

    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: survivor,
      targetCharacterId: third,
      type: "friend_of",
    });
    await createRelationship(accessToken, {
      category: "social",
      directionality: "symmetric",
      sourceCharacterId: loser,
      targetCharacterId: third,
      type: "friend_of",
    });
    await createRelationship(accessToken, {
      category: "conflict",
      directionality: "symmetric",
      sourceCharacterId: survivor,
      targetCharacterId: loser,
      type: "enemy_of",
    });
    await createRelationship(accessToken, {
      category: "mentorship",
      directionality: "directed",
      sourceCharacterId: loser,
      targetCharacterId: fourth,
      type: "mentor_of",
    });

    await authed("post", "/api/character-theories", accessToken)
      .send({ characterId: loser, text: "The loser has a secret" })
      .expect(HttpStatus.CREATED);

    const expectedCounts = {
      aliases: { dropped: 1, moved: 1 },
      appearances: { dropped: 1, moved: 1 },
      memberships: { dropped: 1, moved: 1 },
      relationships: { dropped: 2, moved: 1 },
      roles: { dropped: 2, moved: 1 },
      tags: { dropped: 1, moved: 1 },
      theories: { dropped: 0, moved: 1 },
    };

    const preview = await authed(
      "get",
      `/api/characters/${survivor}/merge-preview?otherId=${loser}`,
      accessToken,
    );
    expect(preview.status).toBe(HttpStatus.OK);
    expect(preview.body.counts).toEqual(expectedCounts);
    expect(preview.body.survivor).toEqual({ id: survivor, name: "Survivor" });
    expect(preview.body.loser).toEqual({ id: loser, name: "Loser" });

    const merged = await authed("post", `/api/characters/${survivor}/merge`, accessToken).send({
      otherId: loser,
    });
    expect(merged.status).toBe(HttpStatus.OK);
    expect(merged.body.counts).toEqual(expectedCounts);
    expect(merged.body.survivor).toEqual({ id: survivor, name: "Survivor" });
    expect(merged.body.loserId).toBe(loser);

    expect(await prisma.character.findUnique({ where: { id: loser } })).toBeNull();

    const survivorAppearances = await prisma.bookCharacter.findMany({
      select: { bookId: true },
      where: { characterId: survivor },
    });
    expect(survivorAppearances.map((row) => row.bookId).sort()).toEqual(
      [book1, book2, book3].sort(),
    );
    expect(await prisma.bookCharacter.count({ where: { characterId: loser } })).toBe(0);

    expect(await prisma.characterAlias.count({ where: { characterId: loser } })).toBe(0);
    const survivorAliases = await prisma.characterAlias.findMany({
      select: { normalizedName: true },
      where: { characterId: survivor },
    });
    expect(survivorAliases.map((row) => row.normalizedName).sort()).toEqual(["muad'dib", "usul"]);

    expect(await prisma.characterTag.count({ where: { characterId: loser } })).toBe(0);
    expect(await prisma.characterTag.count({ where: { characterId: survivor } })).toBe(2);

    expect(await prisma.characterGroupMembership.count({ where: { characterId: loser } })).toBe(0);
    expect(await prisma.characterGroupMembership.count({ where: { characterId: survivor } })).toBe(
      2,
    );

    expect(
      await prisma.characterRelationship.count({
        where: {
          OR: [{ sourceCharacterId: loser }, { targetCharacterId: loser }],
          userId,
        },
      }),
    ).toBe(0);
    expect(
      await prisma.characterRelationship.count({
        where: {
          OR: [{ sourceCharacterId: survivor }, { targetCharacterId: survivor }],
          userId,
        },
      }),
    ).toBe(2);

    expect(await prisma.characterTheory.count({ where: { characterId: loser } })).toBe(0);
    expect(await prisma.characterTheory.count({ where: { characterId: survivor } })).toBe(1);
  });

  it("rejects merging a character into itself", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const survivor = await createCharacter(accessToken, { name: "Survivor" });

    const res = await authed("post", `/api/characters/${survivor}/merge`, accessToken).send({
      otherId: survivor,
    });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(await prisma.character.count({ where: { id: survivor } })).toBe(1);
  });

  it("returns 404 identically for a missing, foreign or missing-other character", async () => {
    const owner = await context.registerVerifyAndLogin();
    const intruder = await context.registerVerifyAndLogin({ email: "intruder@example.com" });
    const survivor = await createCharacter(owner.accessToken, { name: "Survivor" });
    const foreign = await createCharacter(intruder.accessToken, { name: "Foreign" });

    const missingSurvivor = await authed(
      "post",
      `/api/characters/${MISSING_ID}/merge`,
      owner.accessToken,
    ).send({ otherId: survivor });
    expect(missingSurvivor.status).toBe(HttpStatus.NOT_FOUND);

    const missingOther = await authed(
      "post",
      `/api/characters/${survivor}/merge`,
      owner.accessToken,
    ).send({ otherId: MISSING_ID });
    expect(missingOther.status).toBe(HttpStatus.NOT_FOUND);

    const foreignOther = await authed(
      "post",
      `/api/characters/${survivor}/merge`,
      owner.accessToken,
    ).send({ otherId: foreign });
    expect(foreignOther.status).toBe(HttpStatus.NOT_FOUND);
    expect(await prisma.character.count({ where: { id: foreign } })).toBe(1);
  });
});

describe("GET /api/characters/:characterId/merge-preview", () => {
  it("flags hidden loser records without failing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const book = await createBook(accessToken, "Dune");
    const survivor = await createCharacter(accessToken, { name: "Survivor" });
    const loser = await createCharacter(accessToken, { name: "Loser" });
    await linkToBook(accessToken, book, loser, {
      hidePresenceAsSpoiler: true,
      importance: "central",
    });

    const preview = await authed(
      "get",
      `/api/characters/${survivor}/merge-preview?otherId=${loser}`,
      accessToken,
    );
    expect(preview.status).toBe(HttpStatus.OK);
    expect(preview.body.hasHiddenRecords).toBe(true);
    expect(preview.body.counts.appearances).toEqual({ dropped: 0, moved: 1 });
  });
});

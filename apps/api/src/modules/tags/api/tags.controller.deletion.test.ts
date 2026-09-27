import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { TagsUsageFixtures } from "./tags-usage.fixtures.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { TagsModule } from "../tags.module.js";
import { createTagsUsageFixtures } from "./tags-usage.fixtures.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let seed: TagsUsageFixtures;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, TagsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  seed = createTagsUsageFixtures(prisma);
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

const HIDDEN_AT = new Date("2026-01-15T00:00:00.000Z");
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

type LinkedTag = {
  bookIds: string[];
  characterIds: string[];
  tagId: string;
};

function deleteTag(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/tags/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getCatalog(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/tags/catalog")
    .set("Authorization", `Bearer ${accessToken}`);
}

function getPreview(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/tags/${id}/deletion-preview`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedTagWithVisibleAndHiddenLinks(userId: string): Promise<LinkedTag> {
  const visibleBook = await seed.book({ userId });
  const trashedBook = await seed.book({ deletedAt: HIDDEN_AT, userId });
  const visibleCharacter = await seed.character({ name: "Paul", userId });
  const archivedCharacter = await seed.character({
    archivedAt: HIDDEN_AT,
    name: "Archived",
    userId,
  });
  const deletedCharacter = await seed.character({
    deletedAt: HIDDEN_AT,
    name: "Deleted",
    userId,
  });
  await seed.appearIn({
    bookIds: [visibleBook.id, trashedBook.id],
    characterId: visibleCharacter.id,
  });
  const tag = await seed.tag({ name: "doomed", userId });
  const bookIds = [visibleBook.id, trashedBook.id];
  const characterIds = [visibleCharacter.id, archivedCharacter.id, deletedCharacter.id];
  await seed.tagBooks({ bookIds, tagId: tag.id });
  await seed.tagCharacters({ characterIds, tagId: tag.id });
  return { bookIds, characterIds, tagId: tag.id };
}

describe("GET /api/tags/:id/deletion-preview", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/tags/${MISSING_UUID}/deletion-preview`,
    );

    expect(res.status).toBe(401);
  });

  it("B-DEL-P-01 counts every physical book and character link", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const books = [await seed.book({ userId }), await seed.book({ userId })];
    const characters = [
      await seed.character({ name: "Paul", userId }),
      await seed.character({ name: "Chani", userId }),
      await seed.character({ name: "Stilgar", userId }),
    ];
    const tag = await seed.tag({ name: "desert", userId });
    await seed.tagBooks({ bookIds: books.map((book) => book.id), tagId: tag.id });
    await seed.tagCharacters({
      characterIds: characters.map((character) => character.id),
      tagId: tag.id,
    });

    const res = await getPreview(accessToken, tag.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookLinksCount: 2, characterLinksCount: 3 });
  });

  it("B-DEL-P-02 includes links to a trashed book and archived or trashed characters", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { tagId } = await seedTagWithVisibleAndHiddenLinks(userId);

    const catalog = await getCatalog(accessToken);
    const res = await getPreview(accessToken, tagId);

    expect(catalog.body.items[0]).toMatchObject({ booksCount: 1, charactersCount: 1 });
    expect(res.body).toEqual({ bookLinksCount: 2, characterLinksCount: 3 });
  });

  it("B-DEL-P-01 returns zero counts for an unused tag", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const tag = await seed.tag({ name: "lonely", userId });

    const res = await getPreview(accessToken, tag.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookLinksCount: 0, characterLinksCount: 0 });
  });

  it("B-DEL-P-03 returns 404 for another user's tag", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const { tagId } = await seedTagWithVisibleAndHiddenLinks(stranger.userId);

    const res = await getPreview(owner.accessToken, tagId);

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("bookLinksCount");
  });

  it("B-DEL-P-03 returns 404 for a missing tag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getPreview(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/tags/:id integrity", () => {
  it("B-DEL-04 returns 204 with an empty body", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { tagId } = await seedTagWithVisibleAndHiddenLinks(userId);

    const res = await deleteTag(accessToken, tagId);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("B-DEL-01 removes the tag with all its book and character links, including hidden ones", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { tagId } = await seedTagWithVisibleAndHiddenLinks(userId);

    await deleteTag(accessToken, tagId);

    expect(await prisma.tag.count({ where: { id: tagId } })).toBe(0);
    expect(await prisma.bookTag.count({ where: { tagId } })).toBe(0);
    expect(await prisma.characterTag.count({ where: { tagId } })).toBe(0);
  });

  it("B-DEL-02 / I-BOOK-02 keeps every previously tagged book, trashed ones included", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookIds, tagId } = await seedTagWithVisibleAndHiddenLinks(userId);

    await deleteTag(accessToken, tagId);

    expect(await prisma.book.count({ where: { id: { in: bookIds } } })).toBe(2);
  });

  it("B-DEL-02 / I-CHAR-04 keeps every previously tagged character and its book appearances", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { characterIds, tagId } = await seedTagWithVisibleAndHiddenLinks(userId);

    await deleteTag(accessToken, tagId);

    expect(await prisma.character.count({ where: { id: { in: characterIds } } })).toBe(3);
    expect(await prisma.bookCharacter.count({ where: { characterId: { in: characterIds } } })).toBe(
      2,
    );
  });

  it("B-DEL-02 leaves another tag's links on the same book and character untouched", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { bookIds, characterIds, tagId } = await seedTagWithVisibleAndHiddenLinks(userId);
    const survivor = await seed.tag({ name: "survivor", userId });
    await seed.tagBooks({ bookIds, tagId: survivor.id });
    await seed.tagCharacters({ characterIds, tagId: survivor.id });

    await deleteTag(accessToken, tagId);

    const preview = await getPreview(accessToken, survivor.id);
    expect(preview.body).toEqual({ bookLinksCount: 2, characterLinksCount: 3 });
  });

  it("B-DEL-03 removes links added after the preview was read", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { tagId } = await seedTagWithVisibleAndHiddenLinks(userId);
    const preview = await getPreview(accessToken, tagId);
    const lateBook = await seed.book({ userId });
    const lateCharacter = await seed.character({ name: "Late", userId });
    await seed.tagBooks({ bookIds: [lateBook.id], tagId });
    await seed.tagCharacters({ characterIds: [lateCharacter.id], tagId });

    const res = await deleteTag(accessToken, tagId);

    expect(preview.body).toEqual({ bookLinksCount: 2, characterLinksCount: 3 });
    expect(res.status).toBe(204);
    expect(await prisma.bookTag.count({ where: { tagId } })).toBe(0);
    expect(await prisma.characterTag.count({ where: { tagId } })).toBe(0);
  });

  it("returns 404 and keeps the links when deleting another user's tag", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const { tagId } = await seedTagWithVisibleAndHiddenLinks(stranger.userId);

    const res = await deleteTag(owner.accessToken, tagId);

    expect(res.status).toBe(404);
    expect(await prisma.characterTag.count({ where: { tagId } })).toBe(3);
  });
});

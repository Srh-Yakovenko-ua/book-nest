import type { CharacterCustomLabelsView, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { HttpStatus } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { CharactersModule } from "../characters.module.js";

const CUSTOM_LABELS_URL = "/api/character-custom-labels";

const TRASHED_AT = new Date("2026-01-01T00:00:00.000Z");
const PURGE_AT = new Date("2026-02-01T00:00:00.000Z");

type AppearanceSeed = {
  bookId: string;
  characterId: string;
  hidePresenceAsSpoiler?: boolean;
  roles?: RoleSeed[];
  status?: string;
  statusCustomText?: string;
  statusIsSpoiler?: boolean;
};

type RoleSeed = {
  customRole?: string;
  isSpoiler?: boolean;
  roleType: string;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, CharactersModule]);
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

async function createAppearance({ roles = [], ...appearance }: AppearanceSeed): Promise<void> {
  await prisma.bookCharacter.create({
    data: {
      ...appearance,
      roles: {
        create: roles.map((role, position) => ({
          customRole: role.customRole ?? null,
          isSpoiler: role.isSpoiler ?? false,
          position,
          roleType: role.roleType,
        })),
      },
    },
  });
}

async function createBook({
  trashed = false,
  userId,
}: {
  trashed?: boolean;
  userId: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: { title: `Book ${randomUUID()}`, userId, ...trashStamps(trashed) },
  });
  return book.id;
}

async function createCharacter({
  hideProfileAsSpoiler = false,
  trashed = false,
  userId,
}: {
  hideProfileAsSpoiler?: boolean;
  trashed?: boolean;
  userId: string;
}): Promise<string> {
  const name = `Character ${randomUUID()}`;
  const character = await prisma.character.create({
    data: {
      hideProfileAsSpoiler,
      name,
      normalizedName: name.toLowerCase(),
      userId,
      ...trashStamps(trashed),
    },
  });
  return character.id;
}

function getCustomLabels(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get(CUSTOM_LABELS_URL)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedCustomAppearance({
  roles,
  statusCustomText,
  userId,
}: {
  roles: string[];
  statusCustomText?: string;
  userId: string;
}): Promise<void> {
  const bookId = await createBook({ userId });
  const characterId = await createCharacter({ userId });
  await createAppearance({
    bookId,
    characterId,
    roles: roles.map((customRole) => ({ customRole, roleType: "custom" })),
    ...(statusCustomText === undefined ? {} : { status: "other", statusCustomText }),
  });
}

function trashStamps(trashed: boolean): { deletedAt: Nullable<Date>; purgeAt: Nullable<Date> } {
  return trashed
    ? { deletedAt: TRASHED_AT, purgeAt: PURGE_AT }
    : { deletedAt: null, purgeAt: null };
}

describe("GET /api/character-custom-labels", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(CUSTOM_LABELS_URL);

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it("returns empty lists for a user without custom labels", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getCustomLabels(accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual<CharacterCustomLabelsView>({ roles: [], statuses: [] });
  });

  it("merges custom roles and statuses across the user's books, most used first", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const firstBookId = await createBook({ userId });
    const secondBookId = await createBook({ userId });
    const mentorId = await createCharacter({ userId });
    const witnessId = await createCharacter({ userId });
    const exileId = await createCharacter({ userId });

    await createAppearance({
      bookId: firstBookId,
      characterId: mentorId,
      roles: [
        { customRole: "Наставник", roleType: "custom" },
        { customRole: "Свідок", roleType: "custom" },
      ],
      status: "other",
      statusCustomText: "Зник безвісти",
    });
    await createAppearance({
      bookId: secondBookId,
      characterId: mentorId,
      roles: [{ customRole: "наставник ", roleType: "custom" }],
      status: "other",
      statusCustomText: "  зник  безвісти",
    });
    await createAppearance({
      bookId: secondBookId,
      characterId: witnessId,
      roles: [{ customRole: "Наставник", roleType: "custom" }],
      status: "other",
      statusCustomText: "Вигнаний",
    });
    await createAppearance({
      bookId: firstBookId,
      characterId: exileId,
      roles: [{ customRole: "   ", roleType: "custom" }],
      status: "other",
      statusCustomText: "Зник безвісти",
    });

    const res = await getCustomLabels(accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual<CharacterCustomLabelsView>({
      roles: [
        { count: 3, label: "Наставник" },
        { count: 1, label: "Свідок" },
      ],
      statuses: [
        { count: 3, label: "Зник безвісти" },
        { count: 1, label: "Вигнаний" },
      ],
    });
  });

  it("ignores standard roles and statuses even when stale custom text is stored on them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook({ userId });
    const characterId = await createCharacter({ userId });
    await createAppearance({
      bookId,
      characterId,
      roles: [
        { roleType: "protagonist" },
        { customRole: "Залишок старого тексту", roleType: "antagonist" },
      ],
      status: "dead",
      statusCustomText: "Залишок старого статусу",
    });

    const res = await getCustomLabels(accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual<CharacterCustomLabelsView>({ roles: [], statuses: [] });
  });

  it("ignores another user's custom labels", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedCustomAppearance({ roles: ["Мій наставник"], userId: owner.userId });
    await seedCustomAppearance({
      roles: ["Чужий наставник"],
      statusCustomText: "Чужий статус",
      userId: stranger.userId,
    });

    const res = await getCustomLabels(owner.accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual<CharacterCustomLabelsView>({
      roles: [{ count: 1, label: "Мій наставник" }],
      statuses: [],
    });
  });

  it("excludes characters and books in the trash", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const liveBookId = await createBook({ userId });
    const trashedBookId = await createBook({ trashed: true, userId });
    const liveCharacterId = await createCharacter({ userId });
    const trashedCharacterId = await createCharacter({ trashed: true, userId });

    await createAppearance({
      bookId: liveBookId,
      characterId: liveCharacterId,
      roles: [{ customRole: "Живий", roleType: "custom" }],
    });
    await createAppearance({
      bookId: liveBookId,
      characterId: trashedCharacterId,
      roles: [{ customRole: "Персонаж у кошику", roleType: "custom" }],
      status: "other",
      statusCustomText: "Статус персонажа у кошику",
    });
    await createAppearance({
      bookId: trashedBookId,
      characterId: liveCharacterId,
      roles: [{ customRole: "Книга у кошику", roleType: "custom" }],
      status: "other",
      statusCustomText: "Статус книги у кошику",
    });

    const res = await getCustomLabels(accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual<CharacterCustomLabelsView>({
      roles: [{ count: 1, label: "Живий" }],
      statuses: [],
    });
  });

  it("excludes labels hidden as spoilers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook({ userId });
    const openCharacterId = await createCharacter({ userId });
    const hiddenPresenceCharacterId = await createCharacter({ userId });
    const hiddenProfileCharacterId = await createCharacter({ hideProfileAsSpoiler: true, userId });

    await createAppearance({
      bookId,
      characterId: openCharacterId,
      roles: [
        { customRole: "Відкрита роль", roleType: "custom" },
        { customRole: "Роль-спойлер", isSpoiler: true, roleType: "custom" },
      ],
      status: "other",
      statusCustomText: "Статус-спойлер",
      statusIsSpoiler: true,
    });
    await createAppearance({
      bookId,
      characterId: hiddenPresenceCharacterId,
      hidePresenceAsSpoiler: true,
      roles: [{ customRole: "Прихована присутність", roleType: "custom" }],
      status: "other",
      statusCustomText: "Статус прихованої присутності",
    });
    await createAppearance({
      bookId,
      characterId: hiddenProfileCharacterId,
      roles: [{ customRole: "Прихований профіль", roleType: "custom" }],
      status: "other",
      statusCustomText: "Статус прихованого профілю",
    });

    const res = await getCustomLabels(accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toEqual<CharacterCustomLabelsView>({
      roles: [{ count: 1, label: "Відкрита роль" }],
      statuses: [],
    });
  });
});

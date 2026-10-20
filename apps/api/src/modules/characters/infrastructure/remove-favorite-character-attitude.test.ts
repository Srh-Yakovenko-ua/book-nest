import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";

const MIGRATION_URL = new URL(
  "../../../../prisma/migrations/20261020155012_remove_favorite_character_attitude/migration.sql",
  import.meta.url,
);

const STAMPS = {
  archived: new Date("2026-04-01T08:00:00.000Z"),
  seeded: new Date("2026-02-14T09:30:00.000Z"),
  trashed: new Date("2026-05-01T08:00:00.000Z"),
} as const;

const CharacterRowSchema = z.object({
  globalAttitude: z.string().nullable(),
  id: z.string(),
  isFavorite: z.boolean(),
  updatedAt: z.date(),
});

const AppearanceRowSchema = z.object({
  attitude: z.string().nullable(),
  id: z.string(),
  updatedAt: z.date(),
});

const IdRowSchema = z.object({ id: z.string() });

type AttitudeLibrary = Awaited<ReturnType<typeof seedAttitudeLibrary>>;

type AttitudeSnapshot = {
  appearances: z.infer<typeof AppearanceRowSchema>[];
  characters: z.infer<typeof CharacterRowSchema>[];
};

type CharacterSeed = {
  archivedAt?: Nullable<Date>;
  deletedAt?: Nullable<Date>;
  globalAttitude: Nullable<string>;
  isFavorite: boolean;
};

let app: INestApplication;
let prisma: PrismaService;
let migrationSql: string;

beforeAll(async () => {
  app = await createTestApp([]);
  prisma = app.get(PrismaService);
  migrationSql = await readFile(MIGRATION_URL, "utf8");
});

afterAll(async () => {
  await app.close();
});

function appearanceRow(state: AttitudeSnapshot, id: string) {
  return state.appearances.find((row) => row.id === id);
}

function characterRow(state: AttitudeSnapshot, id: string) {
  return state.characters.find((row) => row.id === id);
}

async function createBook(userId: string): Promise<string> {
  const book = await prisma.book.create({
    data: { title: "Attitude probe", userId },
    select: { id: true },
  });
  return book.id;
}

async function createUser(): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: { email: `attitude-${id}@example.test`, id, name: "Attitude probe", passwordHash: "x" },
  });
  return id;
}

async function insertAppearance({
  attitude,
  bookId,
  characterId,
}: {
  attitude: Nullable<string>;
  bookId: string;
  characterId: string;
}): Promise<string> {
  const rows = await prisma.$queryRaw`
    INSERT INTO book_characters (id, book_id, character_id, attitude, updated_at)
    VALUES (gen_random_uuid(), ${bookId}::uuid, ${characterId}::uuid, ${attitude},
            ${STAMPS.seeded})
    RETURNING id::text AS id
  `;
  return z.tuple([IdRowSchema]).parse(rows)[0].id;
}

async function insertCharacter(
  userId: string,
  { archivedAt = null, deletedAt = null, globalAttitude, isFavorite }: CharacterSeed,
): Promise<string> {
  const name = `Character ${randomUUID()}`;
  const purgeAt = deletedAt === null ? null : TRASH_RETENTION.stamp(deletedAt).purgeAt;
  const rows = await prisma.$queryRaw`
    INSERT INTO characters
      (id, user_id, name, normalized_name, global_attitude, is_favorite, archived_at, deleted_at,
       purge_at, updated_at)
    VALUES (gen_random_uuid(), ${userId}::uuid, ${name}, ${name.toLowerCase()}, ${globalAttitude},
            ${isFavorite}, ${archivedAt}::timestamptz, ${deletedAt}::timestamptz,
            ${purgeAt}::timestamptz, ${STAMPS.seeded})
    RETURNING id::text AS id
  `;
  return z.tuple([IdRowSchema]).parse(rows)[0].id;
}

async function migratedLibrary(): Promise<{ library: AttitudeLibrary; state: AttitudeSnapshot }> {
  const library = await seedAttitudeLibrary();
  await runMigration();
  return { library, state: await snapshot() };
}

async function runMigration(): Promise<void> {
  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function seedAttitudeLibrary() {
  const userId = await createUser();
  const bookId = await createBook(userId);
  const character = (seed: CharacterSeed) => insertCharacter(userId, seed);
  const appearance = (characterId: string, attitude: Nullable<string>) =>
    insertAppearance({ attitude, bookId, characterId });

  const characters = {
    archivedFavorite: await character({
      archivedAt: STAMPS.archived,
      globalAttitude: "favorite",
      isFavorite: false,
    }),
    hatedHearted: await character({ globalAttitude: "hate", isFavorite: true }),
    heartedFavorite: await character({ globalAttitude: "favorite", isFavorite: true }),
    likedUnhearted: await character({ globalAttitude: "like", isFavorite: false }),
    neutralWithBookFavorite: await character({ globalAttitude: "neutral", isFavorite: false }),
    trashedFavorite: await character({
      deletedAt: STAMPS.trashed,
      globalAttitude: "favorite",
      isFavorite: false,
    }),
    unheartedFavorite: await character({ globalAttitude: "favorite", isFavorite: false }),
    unset: await character({ globalAttitude: null, isFavorite: false }),
    unsetWithBookFavorite: await character({ globalAttitude: null, isFavorite: false }),
  };

  const appearances = {
    favoriteOfNeutral: await appearance(characters.neutralWithBookFavorite, "favorite"),
    favoriteOfTrashed: await appearance(characters.trashedFavorite, "favorite"),
    favoriteOfUnset: await appearance(characters.unsetWithBookFavorite, "favorite"),
    hate: await appearance(characters.hatedHearted, "hate"),
    like: await appearance(characters.likedUnhearted, "like"),
    unset: await appearance(characters.unset, null),
  };

  return { appearances, characters };
}

async function snapshot(): Promise<AttitudeSnapshot> {
  const [characters, appearances] = await Promise.all([
    prisma.$queryRaw`
      SELECT id::text AS id, global_attitude AS "globalAttitude", is_favorite AS "isFavorite",
             updated_at AS "updatedAt"
      FROM characters ORDER BY id
    `,
    prisma.$queryRaw`
      SELECT id::text AS id, attitude, updated_at AS "updatedAt"
      FROM book_characters ORDER BY id
    `,
  ]);
  return {
    appearances: z.array(AppearanceRowSchema).parse(appearances),
    characters: z.array(CharacterRowSchema).parse(characters),
  };
}

describe("remove favorite character attitude migration", () => {
  afterEach(async () => {
    await truncateAllTables(app);
  });

  it("turns an unhearted global favorite into a hearted like", async () => {
    const { library, state } = await migratedLibrary();

    expect(characterRow(state, library.characters.unheartedFavorite)).toMatchObject({
      globalAttitude: "like",
      isFavorite: true,
    });
  });

  it("keeps an already hearted global favorite hearted as a like", async () => {
    const { library, state } = await migratedLibrary();

    expect(characterRow(state, library.characters.heartedFavorite)).toMatchObject({
      globalAttitude: "like",
      isFavorite: true,
    });
  });

  it("turns a per-book favorite into like", async () => {
    const { library, state } = await migratedLibrary();

    expect(
      [library.appearances.favoriteOfNeutral, library.appearances.favoriteOfUnset].map(
        (id) => appearanceRow(state, id)?.attitude,
      ),
    ).toEqual(["like", "like"]);
  });

  it("leaves the heart and global attitude of a character with only a per-book favorite as they were", async () => {
    const { library, state } = await migratedLibrary();

    expect(characterRow(state, library.characters.neutralWithBookFavorite)).toMatchObject({
      globalAttitude: "neutral",
      isFavorite: false,
    });
    expect(characterRow(state, library.characters.unsetWithBookFavorite)).toMatchObject({
      globalAttitude: null,
      isFavorite: false,
    });
  });

  it("leaves like, hate and unset global attitudes and their hearts untouched", async () => {
    const { library, state } = await migratedLibrary();
    const { characters } = library;

    expect(
      [characters.likedUnhearted, characters.hatedHearted, characters.unset].map((id) => {
        const row = characterRow(state, id);
        return { globalAttitude: row?.globalAttitude, isFavorite: row?.isFavorite };
      }),
    ).toEqual([
      { globalAttitude: "like", isFavorite: false },
      { globalAttitude: "hate", isFavorite: true },
      { globalAttitude: null, isFavorite: false },
    ]);
  });

  it("leaves like, hate and unset per-book attitudes untouched", async () => {
    const { library, state } = await migratedLibrary();
    const { appearances } = library;

    expect(
      [appearances.like, appearances.hate, appearances.unset].map(
        (id) => appearanceRow(state, id)?.attitude,
      ),
    ).toEqual(["like", "hate", null]);
  });

  it("migrates archived and trashed characters and the per-book rows of a trashed one", async () => {
    const { library, state } = await migratedLibrary();
    const { appearances, characters } = library;

    expect(
      [characters.archivedFavorite, characters.trashedFavorite].map((id) => {
        const row = characterRow(state, id);
        return { globalAttitude: row?.globalAttitude, isFavorite: row?.isFavorite };
      }),
    ).toEqual([
      { globalAttitude: "like", isFavorite: true },
      { globalAttitude: "like", isFavorite: true },
    ]);
    expect(appearanceRow(state, appearances.favoriteOfTrashed)?.attitude).toBe("like");
  });

  it("keeps updated_at of every migrated character and per-book row", async () => {
    const { library, state } = await migratedLibrary();
    const { appearances, characters } = library;
    const migratedCharacters = [
      characters.unheartedFavorite,
      characters.heartedFavorite,
      characters.archivedFavorite,
      characters.trashedFavorite,
    ];
    const migratedAppearances = [
      appearances.favoriteOfNeutral,
      appearances.favoriteOfUnset,
      appearances.favoriteOfTrashed,
    ];

    expect(migratedCharacters.map((id) => characterRow(state, id))).toEqual(
      migratedCharacters.map(() =>
        expect.objectContaining({ globalAttitude: "like", updatedAt: STAMPS.seeded }),
      ),
    );
    expect(migratedAppearances.map((id) => appearanceRow(state, id))).toEqual(
      migratedAppearances.map(() =>
        expect.objectContaining({ attitude: "like", updatedAt: STAMPS.seeded }),
      ),
    );
  });

  it("changes nothing on a second run", async () => {
    await seedAttitudeLibrary();
    await runMigration();
    const afterFirst = await snapshot();

    await runMigration();

    await expect(snapshot()).resolves.toEqual(afterFirst);
  });
});

import type { RelationshipDirectionality } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { addDays } from "date-fns";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { env } from "../../../config/env.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { createTestApp } from "../../../test/create-test-app.js";
import { truncateAllTables } from "../../../test/truncate.js";

const MIGRATION_URL = new URL(
  "../../../../prisma/migrations/20261021120000_add_relationship_custom_types/migration.sql",
  import.meta.url,
);

const BACKFILL_START = "CREATE OR REPLACE FUNCTION pg_temp.collapse_relationship_custom_type";

const BASE = new Date("2026-02-01T09:00:00.000Z");

const STAMPS = {
  day0: BASE,
  day1: addDays(BASE, 1),
  day2: addDays(BASE, 2),
  day3: addDays(BASE, 3),
  day9: addDays(BASE, 9),
} as const;

const IdRowSchema = z.object({ id: z.string() });

type EdgeSeed = {
  createdAt?: Date;
  customType: string;
  directionality: RelationshipDirectionality;
  id?: string;
  updatedAt?: Date;
};

type Library = { characterIds: [string, string]; userId: string };

let app: INestApplication;
let prisma: PrismaService;
let backfillSql: string;

beforeAll(async () => {
  app = await createTestApp([]);
  prisma = app.get(PrismaService);
  const migrationSql = await readFile(MIGRATION_URL, "utf8");
  const start = migrationSql.indexOf(BACKFILL_START);
  if (start === -1) {
    throw new Error("the migration no longer contains the custom type backfill");
  }
  backfillSql = migrationSql.slice(start);
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await app.close();
});

async function addBookState(userId: string, relationshipId: string): Promise<void> {
  const book = await prisma.book.create({
    data: { title: "Backfill probe", userId },
    select: { id: true },
  });
  await prisma.$executeRaw`
    INSERT INTO character_relationship_book_states (id, relationship_id, book_id, description, updated_at)
    VALUES (gen_random_uuid(), ${relationshipId}::uuid, ${book.id}::uuid, ${"allies"}, ${STAMPS.day0})
  `;
}

async function createLibrary(): Promise<Library> {
  const userId = randomUUID();
  await prisma.user.create({
    data: {
      email: `backfill-${userId}@example.test`,
      id: userId,
      name: "Backfill probe",
      passwordHash: "x",
    },
  });
  const first = await prisma.character.create({
    data: { name: "Alice", normalizedName: "alice", userId },
    select: { id: true },
  });
  const second = await prisma.character.create({
    data: { name: "Bob", normalizedName: "bob", userId },
    select: { id: true },
  });
  return { characterIds: [first.id, second.id], userId };
}

async function dictionary() {
  return prisma.userRelationshipCustomType.findMany({
    orderBy: [{ normalizedName: "asc" }, { directionality: "asc" }, { name: "asc" }],
    select: {
      createdAt: true,
      directionality: true,
      id: true,
      lastUsedAt: true,
      name: true,
      normalizedName: true,
      updatedAt: true,
      userId: true,
    },
  });
}

async function edgesAndStates() {
  const edges = await prisma.characterRelationship.findMany({
    orderBy: { id: "asc" },
    select: {
      customType: true,
      directionality: true,
      id: true,
      type: true,
      updatedAt: true,
      userId: true,
    },
  });
  const states = await prisma.characterRelationshipBookState.findMany({
    orderBy: { id: "asc" },
    select: { description: true, id: true, relationshipId: true, updatedAt: true },
  });
  return { edges, states };
}

async function insertCustomEdge(library: Library, edge: EdgeSeed): Promise<string> {
  const [source, target] = library.characterIds;
  const createdAt = edge.createdAt ?? STAMPS.day0;
  const rows = await prisma.$queryRaw`
    INSERT INTO character_relationships
      (id, user_id, source_character_id, target_character_id, category, type, custom_type,
       directionality, created_at, updated_at)
    VALUES (${edge.id ?? randomUUID()}::uuid, ${library.userId}::uuid, ${source}::uuid,
            ${target}::uuid, 'custom', 'custom', ${edge.customType}, ${edge.directionality},
            ${createdAt}, ${edge.updatedAt ?? createdAt})
    RETURNING id::text AS id
  `;
  return z.tuple([IdRowSchema]).parse(rows)[0].id;
}

async function runBackfill(): Promise<void> {
  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(backfillSql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

describe("relationship custom type backfill", () => {
  it("T16 groups every user's custom edges by normalized name and directionality", async () => {
    const first = await createLibrary();
    const second = await createLibrary();
    await insertCustomEdge(first, { customType: "Побратими", directionality: "directed" });
    await insertCustomEdge(first, { customType: "  ПОБРАТИМИ ", directionality: "directed" });
    await insertCustomEdge(first, { customType: "Побратими", directionality: "symmetric" });
    await insertCustomEdge(second, { customType: "побратими", directionality: "directed" });

    await runBackfill();
    const owners = new Map([
      [first.userId, "first"],
      [second.userId, "second"],
    ]);
    const keys = (await dictionary()).map(
      (row) => `${owners.get(row.userId)}/${row.normalizedName}/${row.directionality}`,
    );

    expect(keys.sort()).toEqual([
      "first/побратими/directed",
      "first/побратими/symmetric",
      "second/побратими/directed",
    ]);
  });

  it("T16 includes a bare edge that has no book state next to one that has", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, { customType: "Без книги", directionality: "directed" });
    const withState = await insertCustomEdge(library, {
      customType: "З книгою",
      directionality: "directed",
    });
    await addBookState(library.userId, withState);

    await runBackfill();

    expect((await dictionary()).map((row) => row.name)).toEqual(["Без книги", "З книгою"]);
  });

  it("T16 keeps the collapsed spelling of the most recently updated edge as the display name", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, {
      customType: "старі друзі",
      directionality: "directed",
      updatedAt: STAMPS.day1,
    });
    await insertCustomEdge(library, {
      customType: "Старі   Друзі",
      directionality: "directed",
      updatedAt: STAMPS.day2,
    });

    await runBackfill();

    expect(await dictionary()).toEqual([
      expect.objectContaining({ name: "Старі Друзі", normalizedName: "старі друзі" }),
    ]);
  });

  it("T16 breaks a display name tie by the lowest edge id", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, {
      customType: "Побратими",
      directionality: "symmetric",
      id: "20000000-0000-4000-8000-000000000000",
      updatedAt: STAMPS.day1,
    });
    await insertCustomEdge(library, {
      customType: "ПОБРАТИМИ",
      directionality: "symmetric",
      id: "10000000-0000-4000-8000-000000000000",
      updatedAt: STAMPS.day1,
    });

    await runBackfill();

    expect((await dictionary()).map((row) => row.name)).toEqual(["ПОБРАТИМИ"]);
  });

  it("T16 dates an entry from its earliest edge creation to its latest edge activity", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, {
      createdAt: STAMPS.day0,
      customType: "Побратими",
      directionality: "directed",
      updatedAt: STAMPS.day3,
    });
    await insertCustomEdge(library, {
      createdAt: STAMPS.day1,
      customType: "побратими",
      directionality: "directed",
      updatedAt: STAMPS.day1,
    });

    await runBackfill();

    expect(await dictionary()).toEqual([
      expect.objectContaining({ createdAt: STAMPS.day0, lastUsedAt: STAMPS.day3 }),
    ]);
  });

  it("T16 skips blank and over 60 character names and keeps a 60 character one", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, { customType: "   ", directionality: "directed" });
    await insertCustomEdge(library, { customType: "x".repeat(61), directionality: "directed" });
    await insertCustomEdge(library, { customType: "y".repeat(60), directionality: "directed" });

    await runBackfill();

    expect((await dictionary()).map((row) => row.name)).toEqual(["y".repeat(60)]);
  });

  it("T16 leaves every edge and book state as it was, skipped ones included", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, { customType: "   ", directionality: "directed" });
    await insertCustomEdge(library, { customType: "x".repeat(61), directionality: "symmetric" });
    const kept = await insertCustomEdge(library, {
      customType: "Старі   Друзі",
      directionality: "directed",
      updatedAt: STAMPS.day2,
    });
    await addBookState(library.userId, kept);
    const before = await edgesAndStates();

    await runBackfill();

    expect(await edgesAndStates()).toEqual(before);
  });

  it("T17 adds no duplicate and refreshes nothing on a second run", async () => {
    const library = await createLibrary();
    await insertCustomEdge(library, { customType: "Побратими", directionality: "directed" });
    await insertCustomEdge(library, { customType: "Побратими", directionality: "symmetric" });
    await runBackfill();
    const afterFirstRun = await dictionary();

    await runBackfill();

    expect(afterFirstRun).toHaveLength(2);
    expect(await dictionary()).toEqual(afterFirstRun);
  });

  it("T17 never overwrites an entry the live API already wrote", async () => {
    const library = await createLibrary();
    await prisma.userRelationshipCustomType.create({
      data: {
        directionality: "directed",
        lastUsedAt: STAMPS.day0,
        name: "ПОБРАТИМИ",
        normalizedName: "побратими",
        userId: library.userId,
      },
    });
    const live = await dictionary();
    await insertCustomEdge(library, {
      customType: "Побратими",
      directionality: "directed",
      updatedAt: STAMPS.day9,
    });

    await runBackfill();

    expect(await dictionary()).toEqual(live);
  });
});

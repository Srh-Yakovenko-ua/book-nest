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
  "../../../../prisma/migrations/20261021130000_add_relationship_role_suggestions/migration.sql",
  import.meta.url,
);

const BACKFILL_START = "CREATE OR REPLACE FUNCTION pg_temp.collapse_relationship_role_label";

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
  customType?: string;
  id?: string;
  sourceLabel?: string;
  targetLabel?: string;
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
    throw new Error("the migration no longer contains the role suggestion backfill");
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
  return prisma.userRelationshipRoleSuggestion.findMany({
    orderBy: [{ normalizedLabel: "asc" }, { userId: "asc" }],
    select: {
      createdAt: true,
      id: true,
      label: true,
      lastUsedAt: true,
      normalizedLabel: true,
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
      id: true,
      sourceLabel: true,
      targetLabel: true,
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

async function insertEdge(library: Library, edge: EdgeSeed): Promise<string> {
  const [source, target] = library.characterIds;
  const createdAt = edge.createdAt ?? STAMPS.day0;
  const kind =
    edge.customType === undefined
      ? { category: "mentorship", customType: null, directionality: "directed", type: "mentor_of" }
      : {
          category: "custom",
          customType: edge.customType,
          directionality: "symmetric",
          type: "custom",
        };
  const rows = await prisma.$queryRaw`
    INSERT INTO character_relationships
      (id, user_id, source_character_id, target_character_id, category, type, custom_type,
       directionality, source_label, target_label, created_at, updated_at)
    VALUES (${edge.id ?? randomUUID()}::uuid, ${library.userId}::uuid, ${source}::uuid,
            ${target}::uuid, ${kind.category}, ${kind.type}, ${kind.customType},
            ${kind.directionality}, ${edge.sourceLabel ?? null}, ${edge.targetLabel ?? null},
            ${createdAt}, ${edge.updatedAt ?? createdAt})
    RETURNING id::text AS id
  `;
  return z.tuple([IdRowSchema]).parse(rows)[0].id;
}

async function labels(): Promise<string[]> {
  return (await dictionary()).map((row) => row.label);
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

describe("relationship role suggestion backfill", () => {
  it("E10 collects both the source and the target label of an edge", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "Mentor", targetLabel: "Pupil" });

    await runBackfill();

    expect(await dictionary()).toEqual([
      expect.objectContaining({
        label: "Mentor",
        normalizedLabel: "mentor",
        userId: library.userId,
      }),
      expect.objectContaining({ label: "Pupil", normalizedLabel: "pupil", userId: library.userId }),
    ]);
  });

  it("E10 includes a bare standard edge next to a custom edge that has a book state", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "Bare role" });
    const withState = await insertEdge(library, {
      customType: "Sworn kin",
      targetLabel: "Booked role",
    });
    await addBookState(library.userId, withState);

    await runBackfill();

    expect(await labels()).toEqual(["Bare role", "Booked role"]);
  });

  it("E10 E05 merges labels per user by normalized label and keeps users apart", async () => {
    const first = await createLibrary();
    const second = await createLibrary();
    await insertEdge(first, { sourceLabel: "Mentor", targetLabel: "  MENTOR " });
    await insertEdge(first, { sourceLabel: "  НАСТАВНИК ", targetLabel: "Наставник" });
    await insertEdge(second, { sourceLabel: "mentor" });

    await runBackfill();
    const owners = new Map([
      [first.userId, "first"],
      [second.userId, "second"],
    ]);
    const keys = (await dictionary()).map(
      (row) => `${owners.get(row.userId)}/${row.normalizedLabel}`,
    );

    expect(keys.sort()).toEqual(["first/mentor", "first/наставник", "second/mentor"]);
  });

  it("E10 collapses a no-break space the way normalizeName does", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "Old  Mentor" });

    await runBackfill();

    expect(await dictionary()).toEqual([
      expect.objectContaining({ label: "Old Mentor", normalizedLabel: "old mentor" }),
    ]);
  });

  it("E10 keeps the collapsed spelling of the most recently updated edge as the display label", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "old mentor", updatedAt: STAMPS.day1 });
    await insertEdge(library, { targetLabel: "Old   Mentor", updatedAt: STAMPS.day2 });

    await runBackfill();

    expect(await dictionary()).toEqual([
      expect.objectContaining({ label: "Old Mentor", normalizedLabel: "old mentor" }),
    ]);
  });

  it("E10 breaks a display label tie by the lowest edge id and then the source side", async () => {
    const library = await createLibrary();
    await insertEdge(library, {
      id: "20000000-0000-4000-8000-000000000000",
      sourceLabel: "Mentor",
      updatedAt: STAMPS.day1,
    });
    await insertEdge(library, {
      id: "10000000-0000-4000-8000-000000000000",
      sourceLabel: "mentor",
      targetLabel: "MENTOR",
      updatedAt: STAMPS.day1,
    });

    await runBackfill();

    expect(await labels()).toEqual(["mentor"]);
  });

  it("E10 dates an entry from its earliest edge creation to its latest edge activity", async () => {
    const library = await createLibrary();
    await insertEdge(library, {
      createdAt: STAMPS.day0,
      sourceLabel: "Mentor",
      updatedAt: STAMPS.day3,
    });
    await insertEdge(library, {
      createdAt: STAMPS.day1,
      targetLabel: "mentor",
      updatedAt: STAMPS.day1,
    });

    await runBackfill();

    expect(await dictionary()).toEqual([
      expect.objectContaining({ createdAt: STAMPS.day0, lastUsedAt: STAMPS.day3 }),
    ]);
  });

  it("E10 skips blank and over 120 character labels and keeps a 120 character one", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "   ", targetLabel: "x".repeat(121) });
    await insertEdge(library, { sourceLabel: "y".repeat(120) });

    await runBackfill();

    expect(await labels()).toEqual(["y".repeat(120)]);
  });

  it("E10 measures the 120 character limit after collapsing whitespace", async () => {
    const library = await createLibrary();
    const spacedLabel = `${"z".repeat(60)}${" ".repeat(10)}${"z".repeat(59)}`;
    await insertEdge(library, { sourceLabel: spacedLabel });

    await runBackfill();

    expect(await labels()).toEqual([`${"z".repeat(60)} ${"z".repeat(59)}`]);
  });

  it("E10 leaves every edge and book state as it was, skipped labels included", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "   ", targetLabel: "x".repeat(121) });
    const kept = await insertEdge(library, {
      sourceLabel: "Old   Mentor",
      targetLabel: " Pupil ",
      updatedAt: STAMPS.day2,
    });
    await addBookState(library.userId, kept);
    const before = await edgesAndStates();

    await runBackfill();

    expect(await edgesAndStates()).toEqual(before);
  });

  it("E10 adds no duplicate and refreshes nothing on a second run", async () => {
    const library = await createLibrary();
    await insertEdge(library, { sourceLabel: "Mentor", targetLabel: "Pupil" });
    await insertEdge(library, { sourceLabel: "MENTOR" });
    await runBackfill();
    const afterFirstRun = await dictionary();

    await runBackfill();

    expect(afterFirstRun).toHaveLength(2);
    expect(await dictionary()).toEqual(afterFirstRun);
  });

  it("E10 never overwrites an entry the live API already wrote", async () => {
    const library = await createLibrary();
    await prisma.userRelationshipRoleSuggestion.create({
      data: {
        label: "MENTOR",
        lastUsedAt: STAMPS.day0,
        normalizedLabel: "mentor",
        userId: library.userId,
      },
    });
    const live = await dictionary();
    await insertEdge(library, { sourceLabel: "Mentor", updatedAt: STAMPS.day9 });

    await runBackfill();

    expect(await dictionary()).toEqual(live);
  });
});

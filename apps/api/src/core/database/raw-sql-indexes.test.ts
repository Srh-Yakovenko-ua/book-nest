import type { INestApplication } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createTestApp } from "../../test/create-test-app.js";
import { isForeignKeyConstraintError, isUniqueConstraintErrorOn } from "../prisma-errors.js";
import { PrismaService } from "./prisma.service.js";

const IndexRowSchema = z.object({ indexdef: z.string(), indexname: z.string() });

const ConstraintRowSchema = z.object({ conname: z.string() });

const DeleteActionRowSchema = z.object({ onDelete: z.string() });

const ForeignKeyRowSchema = DeleteActionRowSchema.extend({
  column: z.string(),
  table: z.string(),
});

const SpeciesForeignKeyRowSchema = DeleteActionRowSchema.extend({ constraint: z.string() });

const NO_ACTION = "a";

const SPECIES_SHAPE_CHECK = "species_system_or_custom_check";
const RESTRICT = "r";

const MEDIA_REFERENCE_COUNT = 4;

const SOFT_DELETE_TABLES = [
  "books",
  "series",
  "notes",
  "book_lists",
  "quotes",
  "book_timelines",
  "characters",
] as const;

const RAW_SQL_INDEXES = [
  { name: "authors_search_text_trgm_idx", requires: "gin_trgm_ops" },
  { name: "publishers_search_text_trgm_idx", requires: "gin_trgm_ops" },
  { name: "book_order_items_active_book_idx", requires: "cancelled_at IS NULL" },
  { name: "delivery_services_global_provider_key_idx", requires: "user_id IS NULL" },
  { name: "book_loans_active_book_idx", requires: "WHERE" },
  { name: "books_user_queue_position_idx", requires: "deleted_at IS NULL" },
  { name: "books_series_id_part_number_key", requires: "deleted_at IS NULL" },
  { name: "series_user_id_normalized_name_key", requires: "deleted_at IS NULL" },
  { name: "book_lists_user_id_normalized_name_key", requires: "deleted_at IS NULL" },
  { name: "book_timelines_book_id_name_lower_idx", requires: "deleted_at IS NULL" },
  { name: "reading_goals_active_list_idx", requires: "archived_at IS NULL" },
  { name: "book_budgets_active_currency_idx", requires: "valid_to_month IS NULL" },
  { name: "book_reading_cycles_active_book_idx", requires: "state = 'active'" },
  { name: "species_system_key_key", requires: "user_id IS NULL" },
  { name: "species_system_normalized_name_key", requires: "user_id IS NULL" },
  { name: "species_user_id_normalized_name_key", requires: "user_id IS NOT NULL" },
] as const;

const SPECIES_REFERENCE_CONSTRAINTS = [
  "characters_species_id_fkey",
  "book_characters_species_override_id_fkey",
] as const;

let app: INestApplication;
let indexes: Map<string, string>;
let constraints: Set<string>;
let mediaReferenceActions: Map<string, string>;
let bookPublisherDeleteAction: string;
let speciesReferenceActions: Map<string, string>;

beforeAll(async () => {
  app = await createTestApp([]);
  const prisma = app.get(PrismaService);
  const rows = await prisma.$queryRaw`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
  `;
  indexes = new Map(
    z
      .array(IndexRowSchema)
      .parse(rows)
      .map((row) => [row.indexname, row.indexdef]),
  );
  const constraintRows = await prisma.$queryRaw`
    SELECT conname FROM pg_constraint WHERE contype = 'c'
  `;
  constraints = new Set(
    z
      .array(ConstraintRowSchema)
      .parse(constraintRows)
      .map((row) => row.conname),
  );
  const foreignKeyRows = await prisma.$queryRaw`
    SELECT c.conrelid::regclass::text AS "table",
           a.attname AS "column",
           c.confdeltype::text AS "onDelete"
    FROM pg_constraint c
    JOIN unnest(c.conkey) k ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
    WHERE c.confrelid = 'media_assets'::regclass AND c.contype = 'f'
  `;
  mediaReferenceActions = new Map(
    z
      .array(ForeignKeyRowSchema)
      .parse(foreignKeyRows)
      .map((row) => [`${row.table}.${row.column}`, row.onDelete]),
  );
  const publisherForeignKeyRows = await prisma.$queryRaw`
    SELECT confdeltype::text AS "onDelete"
    FROM pg_constraint
    WHERE conname = 'books_publisher_id_fkey' AND contype = 'f'
  `;
  bookPublisherDeleteAction = z
    .tuple([DeleteActionRowSchema])
    .parse(publisherForeignKeyRows)[0].onDelete;
  const speciesForeignKeyRows = await prisma.$queryRaw`
    SELECT conname AS "constraint", confdeltype::text AS "onDelete"
    FROM pg_constraint
    WHERE confrelid = 'species'::regclass AND contype = 'f'
  `;
  speciesReferenceActions = new Map(
    z
      .array(SpeciesForeignKeyRowSchema)
      .parse(speciesForeignKeyRows)
      .map((row) => [row.constraint, row.onDelete]),
  );
});

afterAll(async () => {
  await app.close();
});

describe("indexes that live only in hand-written migration SQL", () => {
  it.each(RAW_SQL_INDEXES)("$name still exists and keeps its predicate", ({ name, requires }) => {
    const definition = indexes.get(name);

    expect(definition, `${name} is missing — a generated migration probably dropped it`).toBeTypeOf(
      "string",
    );
    expect(definition).toContain(requires);
  });

  it("keeps the three trash uniques partial so a trashed row releases its slot", () => {
    for (const name of [
      "books_series_id_part_number_key",
      "series_user_id_normalized_name_key",
      "book_lists_user_id_normalized_name_key",
      "book_timelines_book_id_name_lower_idx",
    ]) {
      expect(indexes.get(name)).toContain("UNIQUE");
    }
  });

  it("keeps the three species uniques partial so a NULL owner cannot slip past them", () => {
    for (const name of [
      "species_system_key_key",
      "species_system_normalized_name_key",
      "species_user_id_normalized_name_key",
    ]) {
      expect(indexes.get(name)).toContain("UNIQUE");
    }
  });
});

describe("check constraints that live only in hand-written migration SQL", () => {
  it.each(SOFT_DELETE_TABLES)("%s keeps purge_at pinned to deleted_at", (table) => {
    expect(
      constraints.has(`${table}_purge_at_matches_deleted_at`),
      `${table} lost the constraint that lets isTrashed() narrow both dates at once`,
    ).toBe(true);
  });

  it("keeps every budget version pinned to the first day of its month", () => {
    expect(
      constraints.has("book_budgets_months_are_first_of_month"),
      "book_budgets lost the constraint that stops a budget covering half a month",
    ).toBe(true);
  });

  it("keeps a notification entity type and id either both set or both null", () => {
    expect(
      constraints.has("notifications_entity_pair_check"),
      "notifications lost the constraint that keeps entity_type and entity_id paired",
    ).toBe(true);
  });

  it("keeps a species either system (key and category) or custom (owner only)", () => {
    expect(
      constraints.has("species_system_or_custom_check"),
      "species lost the constraint that stops a custom row from carrying a system key",
    ).toBe(true);
  });
});

describe("media references are enforced by the database, not by counting in code", () => {
  it("refuses to orphan a media asset from every column that points at one", () => {
    const orphaning = [...mediaReferenceActions]
      .filter(([, onDelete]) => onDelete !== NO_ACTION)
      .map(([reference]) => reference);

    expect(
      orphaning,
      "these columns let MediaService delete a blob that is still in use — they must be ON DELETE NO ACTION",
    ).toEqual([]);
  });

  it("finds at least the references that exist today", () => {
    expect(mediaReferenceActions.size).toBeGreaterThanOrEqual(MEDIA_REFERENCE_COUNT);
  });

  it("still lets a user cascade-delete their own books and media in one statement", async () => {
    const prisma = app.get(PrismaService);
    const userId = randomUUID();
    const mediaId = randomUUID();

    await prisma.user.create({
      data: {
        email: `cascade-${userId}@example.test`,
        id: userId,
        name: "Cascade probe",
        passwordHash: "x",
      },
    });
    await prisma.mediaAsset.create({
      data: {
        contentType: "image/webp",
        height: 10,
        id: mediaId,
        kind: "book_cover",
        sizeBytes: 100,
        storageKey: `probe/${mediaId}`,
        userId,
        width: 10,
      },
    });
    await prisma.book.create({
      data: { coverMediaId: mediaId, title: "Cascade probe", userId },
    });

    await expect(prisma.user.delete({ where: { id: userId } })).resolves.toMatchObject({
      id: userId,
    });
    await expect(prisma.mediaAsset.count({ where: { userId } })).resolves.toBe(0);
  });
});

describe("a publisher cannot be deleted out from under a book", () => {
  it("keeps books.publisher_id ON DELETE RESTRICT so a trashed book never loses its publisher", () => {
    expect(
      bookPublisherDeleteAction,
      "ON DELETE SET NULL lets a publisher deletion silently strip the publisher from trashed books",
    ).toBe(RESTRICT);
  });

  it("refuses to delete a publisher that a trashed book still references", async () => {
    const prisma = app.get(PrismaService);
    const userId = randomUUID();
    const publisherId = randomUUID();
    const trashedAt = new Date("2026-05-01T10:00:00.000Z");

    await prisma.user.create({
      data: {
        email: `restrict-${userId}@example.test`,
        id: userId,
        name: "Restrict probe",
        passwordHash: "x",
      },
    });
    await prisma.publisher.create({
      data: {
        id: publisherId,
        name: "Restrict Press",
        normalizedName: `restrict press ${publisherId}`,
        userId,
      },
    });
    await prisma.book.create({
      data: {
        deletedAt: trashedAt,
        publisherId,
        purgeAt: trashedAt,
        title: "Trashed probe",
        userId,
      },
    });

    const rejection = await prisma.publisher
      .delete({ where: { id: publisherId } })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(isForeignKeyConstraintError(rejection)).toBe(true);
    await expect(prisma.book.count({ where: { publisherId, userId } })).resolves.toBe(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("still lets a stale signup be deleted while its books reference its own custom publisher", async () => {
    const prisma = app.get(PrismaService);
    const userId = randomUUID();
    const publisherId = randomUUID();

    await prisma.user.create({
      data: {
        email: `cleanup-${userId}@example.test`,
        id: userId,
        name: "Cleanup probe",
        passwordHash: "x",
      },
    });
    await prisma.publisher.create({
      data: {
        id: publisherId,
        name: "Cleanup Press",
        normalizedName: `cleanup press ${publisherId}`,
        userId,
      },
    });
    await prisma.publisherName.create({
      data: {
        isPrimary: true,
        locale: "uk",
        name: "Cleanup Press",
        normalizedName: "cleanup press",
        publisherId,
      },
    });
    await prisma.book.create({
      data: { publisherId, title: "Active probe", userId },
    });
    await prisma.book.create({
      data: {
        deletedAt: new Date("2026-05-01T10:00:00.000Z"),
        publisherId,
        purgeAt: new Date("2026-05-01T10:00:00.000Z"),
        title: "Trashed probe",
        userId,
      },
    });

    await expect(prisma.user.delete({ where: { id: userId } })).resolves.toMatchObject({
      id: userId,
    });
    await expect(prisma.publisher.count({ where: { userId } })).resolves.toBe(0);
    await expect(prisma.book.count({ where: { userId } })).resolves.toBe(0);
  });
});

describe("a species cannot be deleted out from under a character", () => {
  it.each(SPECIES_REFERENCE_CONSTRAINTS)("keeps %s ON DELETE RESTRICT", (constraint) => {
    expect(
      speciesReferenceActions.get(constraint),
      "a species deletion must never silently clear a character's species",
    ).toBe(RESTRICT);
  });

  it("refuses to delete a custom species that a character and a book override still use", async () => {
    const prisma = app.get(PrismaService);
    const userId = randomUUID();
    const speciesId = randomUUID();

    await prisma.user.create({
      data: {
        email: `species-restrict-${userId}@example.test`,
        id: userId,
        name: "Species restrict probe",
        passwordHash: "x",
      },
    });
    await prisma.species.create({
      data: { id: speciesId, name: "Скельник", normalizedName: "скельник", userId },
    });
    const character = await prisma.character.create({
      data: { name: "Probe", normalizedName: "probe", speciesId, userId },
    });
    const book = await prisma.book.create({ data: { title: "Species probe", userId } });
    await prisma.bookCharacter.create({
      data: { bookId: book.id, characterId: character.id, speciesOverrideId: speciesId },
    });

    const rejection = await prisma.species
      .delete({ where: { id: speciesId } })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(isForeignKeyConstraintError(rejection)).toBe(true);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("refuses to delete a custom species that only a character uses", async () => {
    const prisma = app.get(PrismaService);
    const userId = await createProbeUser("species-character-only");
    const speciesId = randomUUID();
    await prisma.species.create({
      data: { id: speciesId, name: "Скельник", normalizedName: "скельник", userId },
    });
    await prisma.character.create({
      data: { name: "Probe", normalizedName: "probe", speciesId, userId },
    });

    const rejection = await rejectionOf(prisma.species.delete({ where: { id: speciesId } }));

    expect(isForeignKeyConstraintError(rejection)).toBe(true);
    await expect(prisma.species.count({ where: { id: speciesId } })).resolves.toBe(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("refuses to delete a custom species that only a book override uses", async () => {
    const prisma = app.get(PrismaService);
    const userId = await createProbeUser("species-override-only");
    const speciesId = randomUUID();
    await prisma.species.create({
      data: { id: speciesId, name: "Скельник", normalizedName: "скельник", userId },
    });
    const character = await prisma.character.create({
      data: { name: "Probe", normalizedName: "probe", userId },
    });
    const book = await prisma.book.create({ data: { title: "Species probe", userId } });
    await prisma.bookCharacter.create({
      data: { bookId: book.id, characterId: character.id, speciesOverrideId: speciesId },
    });

    const rejection = await rejectionOf(prisma.species.delete({ where: { id: speciesId } }));

    expect(isForeignKeyConstraintError(rejection)).toBe(true);
    await expect(prisma.species.count({ where: { id: speciesId } })).resolves.toBe(1);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("still lets an account be deleted while its characters use its own custom species", async () => {
    const prisma = app.get(PrismaService);
    const userId = randomUUID();
    const speciesId = randomUUID();

    await prisma.user.create({
      data: {
        email: `species-cleanup-${userId}@example.test`,
        id: userId,
        name: "Species cleanup probe",
        passwordHash: "x",
      },
    });
    await prisma.species.create({
      data: { id: speciesId, name: "Скельник", normalizedName: "скельник", userId },
    });
    const character = await prisma.character.create({
      data: { name: "Probe", normalizedName: "probe", speciesId, userId },
    });
    const trashedAt = new Date("2026-05-01T10:00:00.000Z");
    await prisma.character.create({
      data: {
        deletedAt: trashedAt,
        name: "Trashed probe",
        normalizedName: "trashed probe",
        purgeAt: trashedAt,
        speciesId,
        userId,
      },
    });
    const book = await prisma.book.create({ data: { title: "Species probe", userId } });
    await prisma.bookCharacter.create({
      data: { bookId: book.id, characterId: character.id, speciesOverrideId: speciesId },
    });

    await expect(prisma.user.delete({ where: { id: userId } })).resolves.toMatchObject({
      id: userId,
    });
    await expect(prisma.species.count({ where: { userId } })).resolves.toBe(0);
    await expect(prisma.character.count({ where: { userId } })).resolves.toBe(0);
  });
});

describe("species rows are either system or custom, never a mix", () => {
  it("accepts a system row with a key and a category and a custom row with neither", async () => {
    const prisma = app.get(PrismaService);
    const userId = await createProbeUser("species-shape");
    const probe = systemSpeciesProbe();

    await expect(prisma.species.create({ data: probe })).resolves.toMatchObject({
      key: probe.key,
      userId: null,
    });
    await expect(
      prisma.species.create({ data: { name: "Probe", normalizedName: "probe", userId } }),
    ).resolves.toMatchObject({ key: null, userId });

    await prisma.species.deleteMany({ where: { key: probe.key } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("rejects a custom species that carries a system key", async () => {
    const prisma = app.get(PrismaService);
    const userId = await createProbeUser("species-custom-key");

    const rejection = await rejectionOf(
      prisma.species.create({
        data: { key: `probe_${randomUUID()}`, name: "Probe", normalizedName: "probe", userId },
      }),
    );

    expect(describeRejection(rejection)).toContain(SPECIES_SHAPE_CHECK);
    await expect(prisma.species.count({ where: { userId } })).resolves.toBe(0);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("rejects a custom species that carries a category", async () => {
    const prisma = app.get(PrismaService);
    const userId = await createProbeUser("species-custom-category");

    const rejection = await rejectionOf(
      prisma.species.create({
        data: { categoryKey: "elven", name: "Probe", normalizedName: "probe", userId },
      }),
    );

    expect(describeRejection(rejection)).toContain(SPECIES_SHAPE_CHECK);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("rejects a system species without a key", async () => {
    const prisma = app.get(PrismaService);
    const probe = systemSpeciesProbe();

    const rejection = await rejectionOf(prisma.species.create({ data: { ...probe, key: null } }));

    expect(describeRejection(rejection)).toContain(SPECIES_SHAPE_CHECK);
    await expect(
      prisma.species.count({ where: { normalizedName: probe.normalizedName } }),
    ).resolves.toBe(0);
  });

  it("rejects a system species without a category", async () => {
    const prisma = app.get(PrismaService);
    const probe = systemSpeciesProbe();

    const rejection = await rejectionOf(
      prisma.species.create({ data: { ...probe, categoryKey: null } }),
    );

    expect(describeRejection(rejection)).toContain(SPECIES_SHAPE_CHECK);
    await expect(prisma.species.count({ where: { key: probe.key } })).resolves.toBe(0);
  });
});

describe("species uniques hold even though system rows have a NULL owner", () => {
  it("rejects a second system species with the same key", async () => {
    const prisma = app.get(PrismaService);
    const first = systemSpeciesProbe();
    await prisma.species.create({ data: first });

    const rejection = await rejectionOf(
      prisma.species.create({
        data: { ...systemSpeciesProbe(), key: first.key },
      }),
    );

    expect(isUniqueConstraintErrorOn(rejection, "species_system_key_key")).toBe(true);
    await expect(prisma.species.count({ where: { key: first.key } })).resolves.toBe(1);

    await prisma.species.deleteMany({ where: { key: first.key } });
  });

  it("rejects a second system species with the same normalized name", async () => {
    const prisma = app.get(PrismaService);
    const first = systemSpeciesProbe();
    const second = { ...systemSpeciesProbe(), normalizedName: first.normalizedName };
    await prisma.species.create({ data: first });

    const rejection = await rejectionOf(prisma.species.create({ data: second }));

    expect(isUniqueConstraintErrorOn(rejection, "species_system_normalized_name_key")).toBe(true);

    await prisma.species.deleteMany({ where: { key: { in: [first.key, second.key] } } });
  });

  it("rejects a second custom species with the same normalized name under one owner", async () => {
    const prisma = app.get(PrismaService);
    const userId = await createProbeUser("species-own-duplicate");
    await prisma.species.create({
      data: { name: "Скельник", normalizedName: "скельник", userId },
    });

    const rejection = await rejectionOf(
      prisma.species.create({ data: { name: "СКЕЛЬНИК", normalizedName: "скельник", userId } }),
    );

    expect(isUniqueConstraintErrorOn(rejection, "species_user_id_normalized_name_key")).toBe(true);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("lets two owners and the system tier each hold the same normalized name", async () => {
    const prisma = app.get(PrismaService);
    const firstOwner = await createProbeUser("species-owner-one");
    const secondOwner = await createProbeUser("species-owner-two");
    const system = systemSpeciesProbe();
    await prisma.species.create({ data: system });

    await prisma.species.create({
      data: { name: "Probe", normalizedName: system.normalizedName, userId: firstOwner },
    });
    await prisma.species.create({
      data: { name: "Probe", normalizedName: system.normalizedName, userId: secondOwner },
    });

    await expect(
      prisma.species.count({ where: { normalizedName: system.normalizedName } }),
    ).resolves.toBe(3);

    await prisma.species.deleteMany({ where: { key: system.key } });
    await prisma.user.deleteMany({ where: { id: { in: [firstOwner, secondOwner] } } });
  });
});

async function createProbeUser(label: string): Promise<string> {
  const prisma = app.get(PrismaService);
  const userId = randomUUID();
  await prisma.user.create({
    data: {
      email: `${label}-${userId}@example.test`,
      id: userId,
      name: "Species probe",
      passwordHash: "x",
    },
  });
  return userId;
}

function describeRejection(rejection: unknown): string {
  return rejection instanceof Error ? rejection.message : String(rejection);
}

function rejectionOf(operation: Promise<unknown>): Promise<unknown> {
  return operation.then(() => null).catch((error: unknown) => error);
}

function systemSpeciesProbe(): {
  categoryKey: string;
  key: string;
  name: string;
  normalizedName: string;
} {
  const suffix = randomUUID();
  return {
    categoryKey: "elven",
    key: `probe_${suffix}`,
    name: `Probe ${suffix}`,
    normalizedName: `probe ${suffix}`,
  };
}

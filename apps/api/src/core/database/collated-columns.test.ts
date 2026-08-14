import type { INestApplication } from "@nestjs/common";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createTestApp } from "../../test/create-test-app.js";
import { PrismaService } from "./prisma.service.js";

const CollatedColumnRowSchema = z.object({
  collation: z.string(),
  column: z.string(),
  deterministic: z.boolean(),
  table: z.string(),
});

const DEFAULT_COLLATION = "default";

const UKRAINIAN_COLLATION_INVARIANT = {
  columns: [
    "books.title",
    "books.first_author_name",
    "authors.name",
    "publishers.name",
    "publisher_names.name",
    "series.name",
    "book_lists.name",
    "characters.name",
    "character_groups.name",
    "tags.name",
    "genres.name",
    "delivery_services.name",
    "book_loans.person_name",
    "loan_contacts.name",
    "book_deliveries.store_name",
    "book_deliveries.delivery_service",
    "book_purchase_info.store_name",
    "book_store_links.store_name",
  ],
  name: "uk-UA-x-icu",
} as const;

let app: INestApplication;
let collations: Map<string, { deterministic: boolean; name: string }>;

beforeAll(async () => {
  app = await createTestApp([]);
  const prisma = app.get(PrismaService);
  const rows = await prisma.$queryRaw`
    SELECT t.relname AS "table",
           a.attname AS "column",
           c.collname AS "collation",
           c.collisdeterministic AS "deterministic"
    FROM pg_attribute a
    JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_collation c ON a.attcollation = c.oid
    WHERE n.nspname = 'public'
      AND t.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
  `;
  collations = new Map(
    z
      .array(CollatedColumnRowSchema)
      .parse(rows)
      .map((row) => [
        `${row.table}.${row.column}`,
        { deterministic: row.deterministic, name: row.collation },
      ]),
  );
});

afterAll(async () => {
  await app.close();
});

describe("column collations that live only in hand-written migration SQL", () => {
  it.each(UKRAINIAN_COLLATION_INVARIANT.columns)(
    "%s still orders under the Ukrainian collation",
    (column) => {
      expect(
        collations.get(column)?.name,
        `${column} lost COLLATE "uk-UA-x-icu" — Prisma cannot express a collation, so a generated migration dropped it and Ґ Є І Ї fall back to codepoint order`,
      ).toBe(UKRAINIAN_COLLATION_INVARIANT.name);
    },
  );

  it.each(UKRAINIAN_COLLATION_INVARIANT.columns)(
    "%s keeps a deterministic collation so equality stays byte-exact",
    (column) => {
      expect(
        collations.get(column)?.deterministic,
        `${column} carries a non-deterministic collation — equality, LIKE and every unique index over it would start merging values that used to differ`,
      ).toBe(true);
    },
  );

  it("keeps exactly one non-default collation in the database", () => {
    const nonDefault = [
      ...new Set(
        [...collations.values()]
          .map((collation) => collation.name)
          .filter((name) => name !== DEFAULT_COLLATION),
      ),
    ];

    expect(
      nonDefault,
      "a second non-default collation makes Postgres refuse any comparison that merges the two, so the store_name UNION ALL in book-library-read.repository.ts and the publisher-name COALESCE in publishers.repository.ts would start returning 500s",
    ).toEqual([UKRAINIAN_COLLATION_INVARIANT.name]);
  });
});

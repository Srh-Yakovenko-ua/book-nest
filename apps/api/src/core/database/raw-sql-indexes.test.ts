import type { INestApplication } from "@nestjs/common";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createTestApp } from "../../test/create-test-app.js";
import { PrismaService } from "./prisma.service.js";

const IndexRowSchema = z.object({ indexdef: z.string(), indexname: z.string() });

const RAW_SQL_INDEXES = [
  { name: "authors_search_text_trgm_idx", requires: "gin_trgm_ops" },
  { name: "publishers_search_text_trgm_idx", requires: "gin_trgm_ops" },
  { name: "book_deliveries_active_book_idx", requires: "WHERE" },
  { name: "book_loans_active_book_idx", requires: "WHERE" },
  { name: "books_user_queue_position_idx", requires: "deleted_at IS NULL" },
  { name: "books_series_id_part_number_key", requires: "deleted_at IS NULL" },
  { name: "series_user_id_normalized_name_key", requires: "deleted_at IS NULL" },
  { name: "book_lists_user_id_normalized_name_key", requires: "deleted_at IS NULL" },
  { name: "book_timelines_book_id_name_lower_idx", requires: "deleted_at IS NULL" },
] as const;

let app: INestApplication;
let indexes: Map<string, string>;

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
});

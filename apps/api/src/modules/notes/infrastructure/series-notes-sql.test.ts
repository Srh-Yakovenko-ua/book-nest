import { SeriesNoteSortSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import { buildSeriesNotesSearchCondition, SERIES_NOTE_SORT_ORDER_SQL } from "./series-notes-sql.js";

const PINNED_FIRST_SORT = "pinned_first";

describe("series archive sort", () => {
  const nonPinnedSorts = SeriesNoteSortSchema.options.filter((sort) => sort !== PINNED_FIRST_SORT);

  it.each(nonPinnedSorts)("%s never promotes pinned notes", (sort) => {
    expect(SERIES_NOTE_SORT_ORDER_SQL[sort].sql).not.toContain("is_pinned");
  });

  it.each(SeriesNoteSortSchema.options)("%s ends with the id tiebreaker", (sort) => {
    expect(SERIES_NOTE_SORT_ORDER_SQL[sort].sql.trim().endsWith("note.id ASC")).toBe(true);
  });

  it("pinned_first starts with pinned notes", () => {
    expect(SERIES_NOTE_SORT_ORDER_SQL.pinned_first.sql.startsWith("note.is_pinned DESC")).toBe(
      true,
    );
  });

  it("orders the author sort by the canonical series author, not the book author", () => {
    const authorSort = SERIES_NOTE_SORT_ORDER_SQL.author.sql;
    expect(authorSort).toContain("canonical_author.name");
    expect(authorSort).not.toContain("first_author_name");
    expect(authorSort).toContain("series.name ASC");
  });
});

describe("series archive search", () => {
  const searchSql = buildSeriesNotesSearchCondition("dune").sql;

  it("matches note text, series name, canonical author names and custom category", () => {
    expect(searchSql).toContain("note.text ILIKE");
    expect(searchSql).toContain("series.name ILIKE");
    expect(searchSql).toContain("canonical_author.name ILIKE");
    expect(searchSql).toContain("note.custom_category ILIKE");
  });

  it("does not search book titles, chapter, page or the raw category", () => {
    expect(searchSql).not.toMatch(/title/);
    expect(searchSql).not.toMatch(/chapter/);
    expect(searchSql).not.toMatch(/\bpage\b/);
    expect(searchSql).not.toMatch(/note\.category\b/);
  });
});

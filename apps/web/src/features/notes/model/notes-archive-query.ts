import type { NoteFilter } from "@app/shared";

import {
  BookNotesQuerySchema,
  GenreKeySchema,
  NOTE_ARCHIVE_SORT_DEFAULT,
  NoteCategorySchema,
  NoteCustomCategorySchema,
  NoteFilterSchema,
  SeriesReadingStateSchema,
  SeriesStatusSchema,
} from "@app/shared";
import {
  createParser,
  type inferParserType,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

import type {
  NotesArchiveConfig,
  NotesArchiveDimension,
  NotesArchiveScope,
  NotesArchiveSortByScope,
  NotesMultiDimension,
  NotesPresenceDimension,
  NotesSearchRule,
} from "./notes-archive-config";

import { assertNever } from "./assert-never";
import { NOTES_ARCHIVE_CONFIG } from "./notes-archive-config";

export type NotesValueDimension = "category" | "customCategory" | NotesMultiDimension;

type NotesDimensionKey = NotesPresenceDimension | NotesValueDimension;

type NotesDimensionKeysOf<Dimension extends NotesArchiveDimension> = Dimension extends "category"
  ? "category" | "customCategory"
  : Dimension;

export const NOTES_ARCHIVE = {
  emptyDimensions: {
    author: [],
    book: [],
    category: [],
    customCategory: [],
    genre: [],
    hasChapter: null,
    hasPage: null,
    reading: [],
    series: [],
    status: [],
  } satisfies NotesAdvancedValues,
  filterDefault: "all" as const satisfies NoteFilter,
  pageSize: 20,
  quickFilters: [
    "all",
    "favorite",
    "pinned",
    "no_spoiler",
    "with_spoiler",
  ] as const satisfies readonly NoteFilter[],
  search: {
    minLength: 2,
    pageNumberPattern: /^\d$/,
    schema: BookNotesQuerySchema.shape.search,
  },
  viewModes: ["grid", "list"] as const,
};

export type NotesViewMode = (typeof NOTES_ARCHIVE.viewModes)[number];

function parseAsSchema<T>(schema: z.ZodType<T>) {
  return createParser({
    parse: (value: string) => {
      const result = schema.safeParse(value);
      return result.success ? result.data : null;
    },
    serialize: (value: T) => String(value),
  });
}

const uuidListParser = parseAsArrayOf(parseAsSchema(z.uuid())).withDefault([]);

const NOTES_DIMENSION_PARSERS = {
  author: uuidListParser,
  book: uuidListParser,
  category: parseAsArrayOf(parseAsStringLiteral(NoteCategorySchema.options)).withDefault([]),
  customCategory: parseAsArrayOf(parseAsSchema(NoteCustomCategorySchema)).withDefault([]),
  genre: parseAsArrayOf(parseAsSchema(GenreKeySchema)).withDefault([]),
  hasChapter: parseAsBoolean,
  hasPage: parseAsBoolean,
  reading: parseAsArrayOf(parseAsStringLiteral(SeriesReadingStateSchema.options)).withDefault([]),
  series: uuidListParser,
  status: parseAsArrayOf(parseAsStringLiteral(SeriesStatusSchema.options)).withDefault([]),
};

const NOTES_COMMON_PARSERS = {
  filter: parseAsStringLiteral(NoteFilterSchema.options).withDefault(NOTES_ARCHIVE.filterDefault),
  q: parseAsString.withDefault(""),
  view: parseAsStringLiteral(NOTES_ARCHIVE.viewModes).withDefault("grid"),
};

export const NOTES_ARCHIVE_PARSERS = {
  books: {
    ...NOTES_COMMON_PARSERS,
    ...dimensionParsers(NOTES_ARCHIVE_CONFIG.books.dimensions),
    sort: parseAsStringLiteral(NOTES_ARCHIVE_CONFIG.books.sortOptions).withDefault(
      NOTE_ARCHIVE_SORT_DEFAULT,
    ),
  },
  series: {
    ...NOTES_COMMON_PARSERS,
    ...dimensionParsers(NOTES_ARCHIVE_CONFIG.series.dimensions),
    sort: parseAsStringLiteral(NOTES_ARCHIVE_CONFIG.series.sortOptions).withDefault(
      NOTE_ARCHIVE_SORT_DEFAULT,
    ),
  },
};

export type NotesActiveFilterEntry =
  | { dimension: NotesPresenceDimension; key: string; kind: "presence"; value: boolean }
  | { dimension: NotesValueDimension; key: string; kind: "value"; value: string }
  | { key: string; kind: "search"; query: string };

export type NotesAdvancedValues = inferParserType<typeof NOTES_DIMENSION_PARSERS>;

export type NotesArchiveSnapshot = {
  [Scope in NotesArchiveScope]: { scope: Scope; state: NotesArchiveState<Scope> };
}[NotesArchiveScope];

export type NotesArchiveState<Scope extends NotesArchiveScope = NotesArchiveScope> =
  inferParserType<typeof NOTES_COMMON_PARSERS> &
    NotesAdvancedValues & { sort: NotesArchiveSortByScope[Scope] };

export type NotesDatasetParams = Partial<Pick<NotesAdvancedValues, NotesValueDimension>> &
  Partial<Record<NotesPresenceDimension, boolean>> & { search?: string };

export type NotesListParams = {
  [Scope in NotesArchiveScope]: NotesDatasetParams & {
    filter: NoteFilter;
    pageSize: number;
    scope: Scope;
    sort: NotesArchiveSortByScope[Scope];
  };
}[NotesArchiveScope];

export type NotesStatePatch = {
  [Key in Exclude<keyof NotesArchiveState, "sort">]?: NotesArchiveState[Key] | null;
};

export function activeNotesDimensionCount(
  config: NotesArchiveConfig,
  state: NotesArchiveState,
): number {
  return config.dimensions.reduce(
    (count, dimension) => (isDimensionActive(dimension, state) ? count + 1 : count),
    0,
  );
}

export function committedNotesSearch(rule: NotesSearchRule, query: string): string {
  const parsed = NOTES_ARCHIVE.search.schema.safeParse(query);
  if (!parsed.success || parsed.data === undefined) return "";
  return isNotesSearchCommittable(rule, parsed.data) ? parsed.data : "";
}

export function hasActiveNotesFilters(
  config: NotesArchiveConfig,
  state: NotesArchiveState,
): boolean {
  return (
    committedNotesSearch(config.searchRule, state.q) !== "" ||
    state.filter !== NOTES_ARCHIVE.filterDefault ||
    activeNotesDimensionCount(config, state) > 0
  );
}

export function isNotesSearchCommittable(rule: NotesSearchRule, value: string): boolean {
  if (value.length === 0 || value.length >= NOTES_ARCHIVE.search.minLength) return true;
  return rule === "text_or_page_number" && NOTES_ARCHIVE.search.pageNumberPattern.test(value);
}

export function notesActiveFilterEntries(
  config: NotesArchiveConfig,
  state: NotesArchiveState,
): NotesActiveFilterEntry[] {
  const search = committedNotesSearch(config.searchRule, state.q);
  const searchEntries: NotesActiveFilterEntry[] =
    search === "" ? [] : [{ key: "q", kind: "search", query: search }];

  return [...searchEntries, ...config.dimensions.flatMap(dimensionKeys).flatMap(keyEntries(state))];
}

export function notesAdvancedValues(state: NotesArchiveState): NotesAdvancedValues {
  return {
    author: state.author,
    book: state.book,
    category: state.category,
    customCategory: state.customCategory,
    genre: state.genre,
    hasChapter: state.hasChapter,
    hasPage: state.hasPage,
    reading: state.reading,
    series: state.series,
    status: state.status,
  };
}

export function notesClearAllPatch(config: NotesArchiveConfig): NotesStatePatch {
  const patch: NotesStatePatch = { filter: null, q: null };
  for (const key of config.dimensions.flatMap(dimensionKeys)) {
    patch[key] = null;
  }
  return patch;
}

export function notesFilterRemovalPatch(
  entry: NotesActiveFilterEntry,
  state: NotesArchiveState,
): NotesStatePatch {
  switch (entry.kind) {
    case "presence":
      return entry.dimension === "hasPage" ? { hasPage: null } : { hasChapter: null };
    case "search":
      return { q: null };
    case "value":
      return valueRemovalPatch(entry.dimension, entry.value, state);
    default:
      return assertNever(entry);
  }
}

export function toNotesDatasetParams(
  config: NotesArchiveConfig,
  state: NotesArchiveState,
): NotesDatasetParams {
  const search = committedNotesSearch(config.searchRule, state.q);

  return config.dimensions.reduce<NotesDatasetParams>(
    (params, dimension) => ({ ...params, ...dimensionParams(dimension, state) }),
    search === "" ? {} : { search },
  );
}

export function toNotesListParams(snapshot: NotesArchiveSnapshot): NotesListParams {
  switch (snapshot.scope) {
    case "books":
      return {
        ...unsortedListParams(NOTES_ARCHIVE_CONFIG.books, snapshot.state),
        scope: snapshot.scope,
        sort: snapshot.state.sort,
      };
    case "series":
      return {
        ...unsortedListParams(NOTES_ARCHIVE_CONFIG.series, snapshot.state),
        scope: snapshot.scope,
        sort: snapshot.state.sort,
      };
    default:
      return assertNever(snapshot);
  }
}

function dimensionKeys(dimension: NotesArchiveDimension): NotesDimensionKey[] {
  return dimension === "category" ? ["category", "customCategory"] : [dimension];
}

function dimensionParams(
  dimension: NotesArchiveDimension,
  state: NotesArchiveState,
): NotesDatasetParams {
  switch (dimension) {
    case "author":
      return state.author.length === 0 ? {} : { author: state.author };
    case "book":
      return state.book.length === 0 ? {} : { book: state.book };
    case "category":
      return {
        ...(state.category.length === 0 ? {} : { category: state.category }),
        ...(state.customCategory.length === 0 ? {} : { customCategory: state.customCategory }),
      };
    case "genre":
      return state.genre.length === 0 ? {} : { genre: state.genre };
    case "hasChapter":
      return state.hasChapter === null ? {} : { hasChapter: state.hasChapter };
    case "hasPage":
      return state.hasPage === null ? {} : { hasPage: state.hasPage };
    case "reading":
      return state.reading.length === 0 ? {} : { reading: state.reading };
    case "series":
      return state.series.length === 0 ? {} : { series: state.series };
    case "status":
      return state.status.length === 0 ? {} : { status: state.status };
    default:
      return assertNever(dimension);
  }
}

function dimensionParsers<Dimension extends NotesArchiveDimension>(
  dimensions: readonly Dimension[],
): Pick<typeof NOTES_DIMENSION_PARSERS, NotesDimensionKeysOf<Dimension>> {
  return Object.fromEntries(
    dimensions.flatMap(dimensionKeys).map((key) => [key, NOTES_DIMENSION_PARSERS[key]]),
  ) as Pick<typeof NOTES_DIMENSION_PARSERS, NotesDimensionKeysOf<Dimension>>;
}

function isDimensionActive(dimension: NotesArchiveDimension, state: NotesArchiveState): boolean {
  switch (dimension) {
    case "category":
      return state.category.length > 0 || state.customCategory.length > 0;
    case "hasChapter":
    case "hasPage":
      return state[dimension] !== null;
    default:
      return state[dimension].length > 0;
  }
}

function keyEntries(state: NotesArchiveState) {
  return (key: NotesDimensionKey): NotesActiveFilterEntry[] => {
    if (key === "hasPage" || key === "hasChapter") {
      const value = state[key];
      return value === null ? [] : [{ dimension: key, key, kind: "presence", value }];
    }
    const values: readonly string[] = state[key];
    return values.map((value) => ({
      dimension: key,
      key: `${key}:${value}`,
      kind: "value",
      value,
    }));
  };
}

function unsortedListParams(config: NotesArchiveConfig, state: NotesArchiveState) {
  return {
    ...toNotesDatasetParams(config, state),
    filter: state.filter,
    pageSize: NOTES_ARCHIVE.pageSize,
  };
}

function valueRemovalPatch(
  dimension: NotesValueDimension,
  value: string,
  state: NotesArchiveState,
): NotesStatePatch {
  switch (dimension) {
    case "author":
      return { author: without(state.author, value) };
    case "book":
      return { book: without(state.book, value) };
    case "category":
      return { category: without(state.category, value) };
    case "customCategory":
      return { customCategory: without(state.customCategory, value) };
    case "genre":
      return { genre: without(state.genre, value) };
    case "reading":
      return { reading: without(state.reading, value) };
    case "series":
      return { series: without(state.series, value) };
    case "status":
      return { status: without(state.status, value) };
    default:
      return assertNever(dimension);
  }
}

function without<T extends string>(values: readonly T[], value: string): T[] {
  return values.filter((item) => item !== value);
}

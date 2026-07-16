import type {
  NoteCategory,
  NoteEntityFilter,
  NoteEntityType,
  NoteFilter,
  NoteSort,
  NotesQuery,
  NoteView,
  Nullable,
} from "@app/shared";

import {
  NoteEntityFilterSchema,
  NoteFilterSchema,
  NoteSortSchema,
  NotesQuerySchema,
} from "@app/shared";
import { type inferParserType, parseAsBoolean, parseAsString, parseAsStringLiteral } from "nuqs";

import { NOTE_CATEGORY_OPTIONS } from "./note-categories";

const NOTES_PAGE_SIZE = 20;
const CUSTOM_CATEGORY_PREFIX = "custom:";

export const NOTES_FILTER_DEFAULT = "all" satisfies NoteFilter;
export const NOTES_ENTITY_FILTER_DEFAULT = "all" satisfies NoteEntityFilter;
export const NOTES_SORT_DEFAULT = "pinned_first" satisfies NoteSort;
export const NOTES_CATEGORY_ANY = "any";

export const NOTES_QUICK_FILTER_OPTIONS = NoteFilterSchema.options;
export const NOTES_ENTITY_FILTER_OPTIONS = NoteEntityFilterSchema.options;
export const NOTES_SORT_OPTIONS = NoteSortSchema.options;

export const NOTES_PRESENCE_OPTIONS = ["any", "yes", "no"] as const;

export type NotesCategorySelection =
  | { kind: "any" }
  | { kind: "category"; value: NoteCategory }
  | { kind: "custom"; value: string };

export type NotesPresence = (typeof NOTES_PRESENCE_OPTIONS)[number];

export type NotesScope = {
  entityType: NoteEntityType;
  name: Nullable<string>;
};

export type NotesSidebarFilter =
  | { kind: "category"; value: NoteCategory }
  | { kind: "filter"; value: NoteFilter };

export const NOTES_SIDEBAR_FILTERS = [
  { kind: "filter", value: "favorite" },
  { kind: "filter", value: "pinned" },
  { kind: "filter", value: "no_spoiler" },
  { kind: "filter", value: "with_spoiler" },
  { kind: "category", value: "for_review" },
  { kind: "category", value: "question" },
] as const satisfies readonly NotesSidebarFilter[];

export const notesArchiveParsers = {
  bookId: parseAsString,
  category: parseAsStringLiteral(NOTE_CATEGORY_OPTIONS),
  customCategory: parseAsString,
  entityType: parseAsStringLiteral(NOTES_ENTITY_FILTER_OPTIONS).withDefault(
    NOTES_ENTITY_FILTER_DEFAULT,
  ),
  filter: parseAsStringLiteral(NOTES_QUICK_FILTER_OPTIONS).withDefault(NOTES_FILTER_DEFAULT),
  hasChapter: parseAsBoolean,
  hasPage: parseAsBoolean,
  search: parseAsString.withDefault(""),
  seriesId: parseAsString,
  sort: parseAsStringLiteral(NOTES_SORT_OPTIONS).withDefault(NOTES_SORT_DEFAULT),
};

export type NotesArchiveQueryState = inferParserType<typeof notesArchiveParsers>;

export const NOTES_FILTERS_RESET = {
  bookId: null,
  category: null,
  customCategory: null,
  entityType: null,
  filter: null,
  hasChapter: null,
  hasPage: null,
  search: null,
  seriesId: null,
  sort: null,
} satisfies Record<keyof NotesArchiveQueryState, null>;

const URL_PARAM_SCHEMAS = {
  bookId: NotesQuerySchema.shape.bookId.catch(undefined),
  customCategory: NotesQuerySchema.shape.customCategory.catch(undefined),
  search: NotesQuerySchema.shape.search.catch(undefined),
  seriesId: NotesQuerySchema.shape.seriesId.catch(undefined),
};

export function categorySelectionToState(
  selection: NotesCategorySelection,
): Pick<NotesArchiveQueryState, "category" | "customCategory"> {
  switch (selection.kind) {
    case "any":
      return { category: null, customCategory: null };
    case "category":
      return { category: selection.value, customCategory: null };
    case "custom":
      return { category: null, customCategory: selection.value };
    default:
      return assertNever(selection);
  }
}

export function customCategorySelectValue(value: string): string {
  return `${CUSTOM_CATEGORY_PREFIX}${value}`;
}

export function hasActiveNotesFilters(state: NotesArchiveQueryState): boolean {
  return (
    state.filter !== NOTES_FILTER_DEFAULT ||
    state.entityType !== NOTES_ENTITY_FILTER_DEFAULT ||
    state.category !== null ||
    state.customCategory !== null ||
    state.hasPage !== null ||
    state.hasChapter !== null ||
    state.bookId !== null ||
    state.seriesId !== null
  );
}

export function notesCategorySelectValue(state: NotesArchiveQueryState): string {
  if (state.customCategory !== null) return customCategorySelectValue(state.customCategory);
  return state.category ?? NOTES_CATEGORY_ANY;
}

export function notesScopeFromQuery(query: NotesQuery, notes: NoteView[]): Nullable<NotesScope> {
  if (query.bookId !== undefined) {
    return { entityType: "book", name: notes[0]?.book?.title ?? null };
  }
  if (query.seriesId !== undefined) {
    return { entityType: "series", name: notes[0]?.series?.name ?? null };
  }
  return null;
}

export function parseCategorySelectValue(value: string): NotesCategorySelection {
  if (value === NOTES_CATEGORY_ANY) return { kind: "any" };
  if (value.startsWith(CUSTOM_CATEGORY_PREFIX)) {
    return { kind: "custom", value: value.slice(CUSTOM_CATEGORY_PREFIX.length) };
  }
  const category = NOTE_CATEGORY_OPTIONS.find((option) => option === value);
  return category === undefined ? { kind: "any" } : { kind: "category", value: category };
}

export function presenceToFlag(presence: NotesPresence): Nullable<boolean> {
  switch (presence) {
    case "any":
      return null;
    case "no":
      return false;
    case "yes":
      return true;
    default:
      return assertNever(presence);
  }
}

export function presenceValue(flag: Nullable<boolean>): NotesPresence {
  if (flag === null) return "any";
  return flag ? "yes" : "no";
}

export function toNotesQuery(state: NotesArchiveQueryState): NotesQuery {
  const bookId = URL_PARAM_SCHEMAS.bookId.parse(blankToUndefined(state.bookId));
  const customCategory = URL_PARAM_SCHEMAS.customCategory.parse(
    blankToUndefined(state.customCategory),
  );
  const search = URL_PARAM_SCHEMAS.search.parse(blankToUndefined(state.search));
  const seriesId = URL_PARAM_SCHEMAS.seriesId.parse(blankToUndefined(state.seriesId));

  return {
    entityType: state.entityType,
    filter: state.filter,
    pageNumber: 1,
    pageSize: NOTES_PAGE_SIZE,
    sort: state.sort,
    ...(state.category === null ? {} : { category: state.category }),
    ...(state.hasChapter === null ? {} : { hasChapter: state.hasChapter }),
    ...(state.hasPage === null ? {} : { hasPage: state.hasPage }),
    ...(bookId === undefined ? {} : { bookId }),
    ...(customCategory === undefined ? {} : { customCategory }),
    ...(search === undefined ? {} : { search }),
    ...(seriesId === undefined ? {} : { seriesId }),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled notes archive value: ${String(value)}`);
}

function blankToUndefined(value: Nullable<string>): string | undefined {
  if (value === null) return undefined;
  return value.trim() === "" ? undefined : value;
}

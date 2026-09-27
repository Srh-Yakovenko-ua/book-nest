import { createLoader, createSerializer, type LoaderInput } from "nuqs/server";
import { describe, expect, it } from "vitest";

import { notesKeys } from "../api/notes-keys";
import { NOTES_ARCHIVE_CONFIG } from "./notes-archive-config";
import { canonicalNotesArchiveHref, hasLegacyNotesArchiveParams } from "./notes-archive-legacy";
import {
  activeNotesDimensionCount,
  NOTES_ARCHIVE,
  NOTES_ARCHIVE_PARSERS,
  notesActiveFilterEntries,
  type NotesArchiveState,
  notesClearAllPatch,
  notesFilterRemovalPatch,
  type NotesStatePatch,
  toNotesListParams,
} from "./notes-archive-query";

const BOOK_A = "0f8fad5b-d9cb-469f-a165-70867728950e";
const BOOK_B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const AUTHOR = "1b4e28ba-2fa1-41d2-883f-0016d3dcc2d6";
const SERIES = "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b";

const books = NOTES_ARCHIVE_CONFIG.books;

const parseBooks = createLoader(NOTES_ARCHIVE_PARSERS.books);
const parseSeries = createLoader(NOTES_ARCHIVE_PARSERS.series);
const serializeBooks = createSerializer(NOTES_ARCHIVE_PARSERS.books);

function applyPatch(
  state: NotesArchiveState<"books">,
  patch: NotesStatePatch,
): NotesArchiveState<"books"> {
  return loadBooks(serializeBooks({ ...state, ...patch }));
}

function bookListKey(state: NotesArchiveState<"books">) {
  return notesKeys.archiveList(toNotesListParams({ scope: "books", state }));
}

function bookListParams(input: LoaderInput) {
  return toNotesListParams({ scope: "books", state: loadBooks(input) });
}

function loadBooks(input: LoaderInput): NotesArchiveState<"books"> {
  return { ...NOTES_ARCHIVE.emptyDimensions, ...parseBooks(input) };
}

function loadSeries(input: LoaderInput): NotesArchiveState<"series"> {
  return { ...NOTES_ARCHIVE.emptyDimensions, ...parseSeries(input) };
}

function seriesListParams(input: LoaderInput) {
  return toNotesListParams({ scope: "series", state: loadSeries(input) });
}

describe("notes archive URL state", () => {
  it("reads canonical Books keys and drops malformed ids", () => {
    const input = `?q=dragon&book=${BOOK_A},not-a-uuid&author=${AUTHOR}&category=plot&customCategory=finale&hasPage=true&sort=page&view=list`;

    expect(bookListParams(input)).toEqual({
      author: [AUTHOR],
      book: [BOOK_A],
      category: ["plot"],
      customCategory: ["finale"],
      filter: "all",
      hasPage: true,
      pageSize: 20,
      scope: "books",
      search: "dragon",
      sort: "page",
    });
    expect(loadBooks(input).view).toBe("list");
  });

  it("keeps Series off Book-only sorts and dimensions", () => {
    expect(seriesListParams(`?sort=page&hasPage=true&series=${SERIES}&status=ongoing`)).toEqual({
      filter: "all",
      pageSize: 20,
      scope: "series",
      series: [SERIES],
      sort: "newest",
      status: ["ongoing"],
    });
  });

  it("parses only the keys of its own page", () => {
    const bookPage = parseBooks(`?genre=fantasy&status=ongoing&reading=reading&book=${BOOK_A}`);
    const seriesPage = parseSeries(`?book=${BOOK_A}&hasPage=true&status=ongoing`);

    expect(Object.keys(bookPage).sort()).toEqual([
      "author",
      "book",
      "category",
      "customCategory",
      "filter",
      "hasChapter",
      "hasPage",
      "q",
      "sort",
      "view",
    ]);
    expect(bookPage.book).toEqual([BOOK_A]);
    expect(seriesPage).not.toHaveProperty("book");
    expect(seriesPage).not.toHaveProperty("hasPage");
    expect(seriesPage.status).toEqual(["ongoing"]);
  });

  it("serializes only the keys of its own page", () => {
    const state = { ...loadBooks(`?book=${BOOK_A}`), genre: ["fantasy"], status: ["ongoing"] };

    expect(serializeBooks(state)).toBe(`?book=${BOOK_A}`);
  });
});

describe("notes archive search commit", () => {
  it("commits a one-digit page number on Books only", () => {
    expect(bookListParams("?q=7").search).toBe("7");
    expect(seriesListParams("?q=7").search).toBeUndefined();
  });

  it("ignores a single letter and trims the query", () => {
    expect(bookListParams("?q=a").search).toBeUndefined();
    expect(bookListParams("?q=%20ab%20").search).toBe("ab");
  });
});

describe("notes archive filters", () => {
  it("counts active dimensions, not selected values", () => {
    const state = loadBooks(
      `?book=${BOOK_A},${BOOK_B}&category=plot&customCategory=finale&filter=favorite&q=dragon`,
    );

    expect(activeNotesDimensionCount(books, state)).toBe(2);
  });

  it("removes only one value when its chip is removed", () => {
    const state = loadBooks(`?book=${BOOK_A},${BOOK_B}&author=${AUTHOR}`);
    const entry = notesActiveFilterEntries(books, state).find(
      (candidate) => candidate.kind === "value" && candidate.value === BOOK_A,
    );
    if (entry === undefined) throw new Error("missing book chip");

    const next = applyPatch(state, notesFilterRemovalPatch(entry, state));

    expect(next.book).toEqual([BOOK_B]);
    expect(next.author).toEqual([AUTHOR]);
  });

  it("clears search, quick filter and advanced filters but keeps sort and view", () => {
    const state = loadBooks(
      `?q=dragon&filter=pinned&book=${BOOK_A}&hasChapter=false&sort=title&view=list`,
    );

    const next = applyPatch(state, notesClearAllPatch(books));

    expect(next).toMatchObject({
      book: [],
      filter: "all",
      hasChapter: null,
      q: "",
      sort: "title",
      view: "list",
    });
  });
});

describe("notes archive list query key", () => {
  const base = loadBooks(`?q=dragon&book=${BOOK_A}`);

  it("does not change when only the view changes", () => {
    expect(bookListKey({ ...base, view: "list" })).toEqual(bookListKey({ ...base, view: "grid" }));
  });

  it.each<[string, Partial<NotesArchiveState<"books">>]>([
    ["search", { q: "phoenix" }],
    ["quick filter", { filter: "favorite" }],
    ["sort", { sort: "oldest" }],
    ["advanced filter", { hasPage: true }],
  ])("changes when the %s changes", (_, patch) => {
    expect(bookListKey({ ...base, ...patch })).not.toEqual(bookListKey(base));
  });
});

describe("legacy /notes links", () => {
  it("sends a book link to the Books page", () => {
    expect(canonicalNotesArchiveHref({ bookId: BOOK_A, search: "ring" })).toEqual({
      pathname: "/notes/books",
      query: { book: BOOK_A, q: "ring" },
    });
  });

  it("sends series links to the Series page", () => {
    expect(canonicalNotesArchiveHref({ seriesId: SERIES })).toEqual({
      pathname: "/notes/series",
      query: { series: SERIES },
    });
    expect(canonicalNotesArchiveHref({ entityType: "series", filter: "pinned" })).toEqual({
      pathname: "/notes/series",
      query: { filter: "pinned" },
    });
  });

  it("defaults a bare /notes to the Books page", () => {
    expect(canonicalNotesArchiveHref({})).toEqual({ pathname: "/notes/books", query: {} });
  });

  it("drops keys the target page does not parse and stale values", () => {
    expect(
      canonicalNotesArchiveHref({
        bookId: BOOK_A,
        entityType: "all",
        genre: "fantasy",
        search: "ring",
        sort: "favorite_first",
        status: "ongoing",
      }),
    ).toEqual({ pathname: "/notes/books", query: { book: BOOK_A, q: "ring" } });
    expect(canonicalNotesArchiveHref({ hasPage: "true", seriesId: SERIES, sort: "page" })).toEqual({
      pathname: "/notes/series",
      query: { series: SERIES },
    });
  });

  it("keeps valid canonical keys and drops malformed values", () => {
    expect(
      canonicalNotesArchiveHref(
        { book: `${BOOK_A},not-a-uuid`, entityType: "all", filter: "pinned", sort: "page" },
        "books",
      ),
    ).toEqual({
      pathname: "/notes/books",
      query: { book: BOOK_A, filter: "pinned", sort: "page" },
    });
  });

  it("detects legacy keys only", () => {
    expect(hasLegacyNotesArchiveParams({ q: "ring" })).toBe(false);
    expect(hasLegacyNotesArchiveParams({ search: "ring" })).toBe(true);
  });
});

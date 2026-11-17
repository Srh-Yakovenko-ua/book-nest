import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { RelationshipBookOption } from "./relationship-adapter";
import type { RelationshipCreateBookContext } from "./relationship-book-step";
import type { RelationshipScope } from "./relationship-scope";

import {
  defaultRelationshipBookId,
  findRelationshipCreateBookTitle,
  resolveRelationshipCreateBookContext,
  toRelationshipCreateInitialBookId,
  toRelationshipEditBookStep,
} from "./relationship-book-step";
import {
  makeEditableBookState,
  makeEditableRelationship,
  RELATIONSHIP_FIXTURE,
} from "./relationships.fixtures";

type CreateBookCase = {
  context: RelationshipCreateBookContext;
  createBookOptions: readonly RelationshipBookOption[];
  initialBookId: Nullable<string>;
  name: string;
  scope: RelationshipScope;
};

const FIRST_BOOK: RelationshipBookOption = RELATIONSHIP_FIXTURE.book;
const SECOND_BOOK: RelationshipBookOption = RELATIONSHIP_FIXTURE.secondBook;
const THIRD_BOOK: RelationshipBookOption = {
  id: "3c3c3c3c-0000-4000-8000-000000000005",
  title: "Хрещення вогнем",
};
const SERIES_BOOKS = [FIRST_BOOK, SECOND_BOOK, THIRD_BOOK];
const CHARACTER_ID = RELATIONSHIP_FIXTURE.geralt.id;
const SERIES_ID = "5a5a5a5a-0000-4000-8000-000000000003";

describe("resolveRelationshipCreateBookContext", () => {
  it.each<CreateBookCase>([
    {
      context: { book: FIRST_BOOK, kind: "fixed" },
      createBookOptions: [FIRST_BOOK],
      initialBookId: FIRST_BOOK.id,
      name: "R44 fixes the page book on a book page",
      scope: { bookId: FIRST_BOOK.id, kind: "book" },
    },
    {
      context: { book: SECOND_BOOK, kind: "fixed" },
      createBookOptions: SERIES_BOOKS,
      initialBookId: SECOND_BOOK.id,
      name: "R45 fixes the context book for a character opened inside a book",
      scope: { characterId: CHARACTER_ID, contextBookId: SECOND_BOOK.id, kind: "character" },
    },
    {
      context: { book: SECOND_BOOK, kind: "auto" },
      createBookOptions: [SECOND_BOOK],
      initialBookId: SECOND_BOOK.id,
      name: "R03 R46 takes the only book of a global character without asking",
      scope: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
    },
    {
      context: { defaultBookId: null, kind: "choice", options: [FIRST_BOOK, SECOND_BOOK] },
      createBookOptions: [FIRST_BOOK, SECOND_BOOK],
      initialBookId: null,
      name: "R03 R47 asks a global character with two books to pick one instead of taking the first",
      scope: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
    },
    {
      context: { kind: "blocked", reason: "character-without-books" },
      createBookOptions: [],
      initialBookId: null,
      name: "R14 R48 blocks a global character that has no books",
      scope: { characterId: CHARACTER_ID, contextBookId: null, kind: "character" },
    },
    {
      context: { defaultBookId: SECOND_BOOK.id, kind: "choice", options: SERIES_BOOKS },
      createBookOptions: SERIES_BOOKS,
      initialBookId: SECOND_BOOK.id,
      name: "R04 R49 defaults a series to its context book and still offers every series book, later volumes included",
      scope: { contextBookId: SECOND_BOOK.id, kind: "series", seriesId: SERIES_ID },
    },
    {
      context: { defaultBookId: null, kind: "choice", options: SERIES_BOOKS },
      createBookOptions: SERIES_BOOKS,
      initialBookId: null,
      name: "R04 R49 asks a series without a context book to pick one instead of taking the first",
      scope: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
    },
    {
      context: { kind: "blocked", reason: "series-without-books" },
      createBookOptions: [],
      initialBookId: null,
      name: "R50 blocks a series that has no books",
      scope: { contextBookId: null, kind: "series", seriesId: SERIES_ID },
    },
  ])("$name", ({ context, createBookOptions, initialBookId, scope }) => {
    const resolved = resolveRelationshipCreateBookContext({ createBookOptions, scope });

    expect({
      context: resolved,
      initialBookId: toRelationshipCreateInitialBookId(resolved),
    }).toEqual({ context, initialBookId });
  });
});

describe("findRelationshipCreateBookTitle", () => {
  it("names the series book the author picked rather than the first one offered", () => {
    expect(
      findRelationshipCreateBookTitle({
        bookId: SECOND_BOOK.id,
        context: { defaultBookId: null, kind: "choice", options: SERIES_BOOKS },
      }),
    ).toBe("Меч призначення");
  });
});

describe("defaultRelationshipBookId for edit", () => {
  it("keeps preselecting the first listed book the edited relationship already has a state in", () => {
    const relationship = makeEditableRelationship({
      bookStates: [
        makeEditableBookState({ bookId: THIRD_BOOK.id, id: "state-3" }),
        makeEditableBookState({ bookId: SECOND_BOOK.id, id: "state-2" }),
      ],
    });
    const scope: RelationshipScope = {
      characterId: CHARACTER_ID,
      contextBookId: null,
      kind: "character",
    };
    const step = toRelationshipEditBookStep({ bookOptions: SERIES_BOOKS, relationship, scope });

    expect(defaultRelationshipBookId({ relationship, scope, step })).toBe(SECOND_BOOK.id);
  });
});

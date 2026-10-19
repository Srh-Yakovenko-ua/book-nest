import type { CharacterRelationshipSafeDetailsView, Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  RelationshipBookStateSource,
  RelationshipSource,
} from "./character-relationship.mapper.js";
import type {
  ReaderBook,
  ReaderBookPosition,
  ReaderScope,
  RelationshipReaderProjection,
  RelationshipReveal,
} from "./relationship-reader-projection.js";

import {
  evaluateStateVisibility,
  isPermittedBookState,
  projectRelationshipForReader,
  resolveReaderBookPosition,
  toSafeRelationshipContextView,
  toSafeRelationshipDetailsView,
} from "./relationship-reader-projection.js";

type RelationshipFixture = RelationshipSource & { bookStates: RelationshipBookStateSource[] };

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");
const EDGE_UPDATED_AT = new Date("2026-01-02T00:00:00.000Z");
const STATE_UPDATED_AT = new Date("2026-01-03T00:00:00.000Z");
const HIDDEN_UPDATED_AT = new Date("2026-01-09T00:00:00.000Z");

const UNKNOWN: ReaderBookPosition = { kind: "unknown" };
const FINISHED: ReaderBookPosition = { kind: "finished" };
const NO_REVEAL: RelationshipReveal = { descriptionBookStateId: null, type: false };

const PARTICIPANTS = {
  source: { avatar: null, id: "character-source", name: "Alice" },
  target: { avatar: null, id: "character-target", name: "Bob" },
};

function atPage(page: number): ReaderBookPosition {
  return { kind: "position", reader: { page } };
}

function book(overrides: Partial<ReaderBook> & { id: string }): ReaderBook {
  return { partNumber: null, position: UNKNOWN, seriesId: null, title: overrides.id, ...overrides };
}

function details({
  books,
  edge,
  reveal = NO_REVEAL,
  scope,
}: {
  books: ReaderBook[];
  edge: RelationshipFixture;
  reveal?: RelationshipReveal;
  scope: ReaderScope;
}): Nullable<CharacterRelationshipSafeDetailsView> {
  const projection = project({ books, edge, scope });
  if (projection === null) {
    return null;
  }
  return toSafeRelationshipDetailsView({
    participants: PARTICIPANTS,
    projection,
    relationship: edge,
    reveal,
  });
}

function directDetails({
  position,
  stateOverrides,
}: {
  position: ReaderBookPosition;
  stateOverrides: Partial<RelationshipBookStateSource>;
}): Nullable<CharacterRelationshipSafeDetailsView> {
  return details({
    books: [book({ id: "book-a", position })],
    edge: relationship({ bookStates: [state({ bookId: "book-a", ...stateOverrides })] }),
    scope: { bookId: "book-a", kind: "direct" },
  });
}

function project({
  books,
  edge,
  scope,
}: {
  books: ReaderBook[];
  edge: RelationshipFixture;
  scope: ReaderScope;
}): Nullable<RelationshipReaderProjection> {
  return projectRelationshipForReader({
    context: { books: new Map(books.map((entry) => [entry.id, entry])), scope },
    relationship: edge,
  });
}

function relationship(overrides: Partial<RelationshipFixture> = {}): RelationshipFixture {
  return {
    bookStates: [],
    category: "family",
    createdAt: CREATED_AT,
    customType: "sworn kin",
    directionality: "directed",
    id: "relationship-1",
    isCanonical: true,
    sourceCharacter: { name: "Alice" },
    sourceCharacterId: "character-source",
    sourceLabel: "parent",
    targetCharacter: { name: "Bob" },
    targetCharacterId: "character-target",
    targetLabel: "child",
    type: "biological_parent_of",
    updatedAt: EDGE_UPDATED_AT,
    ...overrides,
  };
}

function requireProjection(input: {
  books: ReaderBook[];
  edge: RelationshipFixture;
  scope: ReaderScope;
}): RelationshipReaderProjection {
  const projection = project(input);
  if (projection === null) {
    throw new Error("Expected the relationship to be visible in this scope");
  }
  return projection;
}

function state(
  overrides: Partial<RelationshipBookStateSource> & { bookId: string },
): RelationshipBookStateSource {
  return {
    createdAt: CREATED_AT,
    description: null,
    endedAudioSeconds: null,
    endedChapter: null,
    endedPage: null,
    hideRelationshipAsSpoiler: false,
    id: `state-${overrides.bookId}`,
    intensity: null,
    introducedAudioSeconds: null,
    introducedChapter: null,
    introducedPage: null,
    isDescriptionSpoiler: false,
    isTypeSpoiler: false,
    relationshipId: "relationship-1",
    status: "active",
    updatedAt: STATE_UPDATED_AT,
    ...overrides,
  };
}

describe("resolveReaderBookPosition", () => {
  it("prefers an explicit position over persisted progress", () => {
    expect(
      resolveReaderBookPosition({
        explicit: { page: 5 },
        progress: { currentPage: 300, finishedAt: CREATED_AT },
      }),
    ).toEqual({ kind: "position", reader: { page: 5 } });
  });

  it("treats a persisted finishedAt as finished even with a current page", () => {
    expect(
      resolveReaderBookPosition({
        explicit: undefined,
        progress: { currentPage: 10, finishedAt: CREATED_AT },
      }),
    ).toEqual({ kind: "finished" });
  });

  it("uses a persisted positive current page as the reader page", () => {
    expect(
      resolveReaderBookPosition({
        explicit: undefined,
        progress: { currentPage: 42, finishedAt: null },
      }),
    ).toEqual({ kind: "position", reader: { page: 42 } });
  });

  it("is unknown when there is no persisted progress", () => {
    expect(resolveReaderBookPosition({ explicit: undefined, progress: null })).toEqual({
      kind: "unknown",
    });
  });

  it("is unknown when the persisted progress has neither a finish nor a page", () => {
    expect(
      resolveReaderBookPosition({
        explicit: undefined,
        progress: { currentPage: 0, finishedAt: null },
      }),
    ).toEqual({ kind: "unknown" });
  });
});

describe("evaluateStateVisibility introduction gating", () => {
  it.each([
    {
      expected: "omitted",
      markers: { introducedPage: 10 },
      name: "omits a page introduction while the position is unknown",
      position: UNKNOWN,
    },
    {
      expected: "omitted",
      markers: { introducedChapter: "3" },
      name: "omits a chapter introduction while the position is unknown",
      position: UNKNOWN,
    },
    {
      expected: "visible",
      markers: {},
      name: "shows a state without introduction markers while the position is unknown",
      position: UNKNOWN,
    },
    {
      expected: "visible",
      markers: { introducedChapter: "   " },
      name: "treats a blank chapter as no introduction marker",
      position: UNKNOWN,
    },
    {
      expected: "visible",
      markers: { introducedAudioSeconds: 900, introducedChapter: "9", introducedPage: 400 },
      name: "shows every introduction to a finished reader",
      position: FINISHED,
    },
    {
      expected: "visible",
      markers: { introducedPage: 10 },
      name: "shows a page introduction the reader page has reached",
      position: atPage(10),
    },
    {
      expected: "omitted",
      markers: { introducedPage: 10 },
      name: "omits a page introduction ahead of the reader page",
      position: atPage(9),
    },
    {
      expected: "visible",
      markers: { introducedChapter: "3" },
      name: "shows an integer chapter introduction the reader chapter has reached",
      position: { kind: "position", reader: { chapter: 3 } },
    },
    {
      expected: "omitted",
      markers: { introducedChapter: "3" },
      name: "omits an integer chapter introduction ahead of the reader chapter",
      position: { kind: "position", reader: { chapter: 2 } },
    },
    {
      expected: "omitted",
      markers: { introducedChapter: "Prologue" },
      name: "omits a non-numeric chapter introduction that cannot be compared",
      position: { kind: "position", reader: { chapter: 50 } },
    },
    {
      expected: "visible",
      markers: { introducedAudioSeconds: 600 },
      name: "shows an audio introduction the reader has reached",
      position: { kind: "position", reader: { audioSeconds: 600 } },
    },
    {
      expected: "omitted",
      markers: { introducedAudioSeconds: 600 },
      name: "omits an audio introduction ahead of the reader",
      position: { kind: "position", reader: { audioSeconds: 599 } },
    },
  ] satisfies {
    expected: "omitted" | "visible";
    markers: Partial<RelationshipBookStateSource>;
    name: string;
    position: ReaderBookPosition;
  }[])("$name", ({ expected, markers, position }) => {
    const visibility = evaluateStateVisibility({
      position,
      state: state({ bookId: "book-a", ...markers }),
    });

    expect(visibility.kind).toBe(expected);
  });

  it("omits a whole-hidden state even for a finished reader", () => {
    const visibility = evaluateStateVisibility({
      position: FINISHED,
      state: state({ bookId: "book-a", hideRelationshipAsSpoiler: true }),
    });

    expect(visibility).toEqual({ kind: "omitted" });
  });
});

describe("ending rule", () => {
  it("nulls an ended status and its end markers before the reader reaches the end", () => {
    const view = directDetails({
      position: atPage(20),
      stateOverrides: { endedChapter: "7", endedPage: 50, status: "ended" },
    });

    expect(view?.effectiveState).toMatchObject({
      endedAudioSeconds: null,
      endedChapter: null,
      endedPage: null,
      status: null,
    });
  });

  it("nulls an ended status and its end markers while the position is unknown", () => {
    const view = directDetails({
      position: UNKNOWN,
      stateOverrides: { endedAudioSeconds: 3600, status: "ended" },
    });

    expect(view?.effectiveState).toMatchObject({ endedAudioSeconds: null, status: null });
  });

  it("keeps a non-ended status but nulls an unreached end marker", () => {
    const view = directDetails({
      position: atPage(20),
      stateOverrides: { endedPage: 50, status: "active" },
    });

    expect(view?.effectiveState).toMatchObject({ endedPage: null, status: "active" });
  });

  it("keeps an ended status without an end marker even while the position is unknown", () => {
    const view = directDetails({ position: UNKNOWN, stateOverrides: { status: "ended" } });

    expect(view?.effectiveState?.status).toBe("ended");
  });

  it("shows the ended status and end markers once the reader reaches the end", () => {
    const view = directDetails({
      position: atPage(50),
      stateOverrides: { endedPage: 50, status: "ended" },
    });

    expect(view?.effectiveState).toMatchObject({ endedPage: 50, status: "ended" });
  });
});

describe("as_of projection", () => {
  const firstPart = book({ id: "book-p1", partNumber: 1, position: FINISHED, seriesId: "s-1" });
  const asOf: ReaderScope = { contextBookId: "book-p2", kind: "as_of" };

  it("inherits the latest earlier state when the context book has none", () => {
    const view = details({
      books: [firstPart, book({ id: "book-p2", partNumber: 2, seriesId: "s-1" })],
      edge: relationship({ bookStates: [state({ bookId: "book-p1", description: "allies" })] }),
      scope: asOf,
    });

    expect(view?.effectiveState).toMatchObject({ bookId: "book-p1", description: "allies" });
  });

  it("omits the edge instead of falling back when the latest allowed state is not yet introduced", () => {
    const view = details({
      books: [firstPart, book({ id: "book-p2", partNumber: 2, position: atPage(10) })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-p1", description: "allies" }),
          state({ bookId: "book-p2", introducedPage: 100 }),
        ],
      }),
      scope: asOf,
    });

    expect(view).toBeNull();
  });

  it("omits the edge instead of falling back when the latest allowed state is whole-hidden", () => {
    const view = details({
      books: [firstPart, book({ id: "book-p2", partNumber: 2, position: FINISHED })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-p1" }),
          state({ bookId: "book-p2", hideRelationshipAsSpoiler: true }),
        ],
      }),
      scope: asOf,
    });

    expect(view).toBeNull();
  });

  it("ignores a state in a book outside the allowed set", () => {
    const view = details({
      books: [firstPart, book({ id: "book-p2", partNumber: 2, position: FINISHED })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-p2", status: "active" }),
          state({ bookId: "book-p3", description: "betrayal", status: "ended" }),
        ],
      }),
      scope: asOf,
    });

    expect(view?.effectiveState).toMatchObject({ bookId: "book-p2", status: "active" });
    expect(JSON.stringify(view)).not.toContain("betrayal");
  });

  it("masks the type from the effective state rather than an earlier one", () => {
    const view = details({
      books: [firstPart, book({ id: "book-p2", partNumber: 2, position: FINISHED })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-p1", isTypeSpoiler: true }),
          state({ bookId: "book-p2" }),
        ],
      }),
      scope: asOf,
    });

    expect(view?.relationship).toMatchObject({ type: "biological_parent_of", typeHidden: false });
  });

  it("orders the permitted history by part number", () => {
    const view = details({
      books: [book({ id: "book-p2", partNumber: 2, position: FINISHED }), firstPart],
      edge: relationship({
        bookStates: [state({ bookId: "book-p2" }), state({ bookId: "book-p1" })],
      }),
      scope: asOf,
    });

    expect(view?.history.map((entry) => entry.bookId)).toEqual(["book-p1", "book-p2"]);
  });
});

describe("direct projection", () => {
  it("returns only the state of the scoped book", () => {
    const view = details({
      books: [book({ id: "book-a", position: FINISHED })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-a", description: "here" }),
          state({ bookId: "book-b", description: "elsewhere" }),
        ],
      }),
      scope: { bookId: "book-a", kind: "direct" },
    });

    expect(view?.effectiveState?.bookId).toBe("book-a");
    expect(view?.history.map((entry) => entry.bookId)).toEqual(["book-a"]);
    expect(JSON.stringify(view)).not.toContain("elsewhere");
  });

  it("omits an edge without a state in the scoped book", () => {
    const view = details({
      books: [book({ id: "book-a", position: FINISHED })],
      edge: relationship({ bookStates: [state({ bookId: "book-b" })] }),
      scope: { bookId: "book-a", kind: "direct" },
    });

    expect(view).toBeNull();
  });
});

describe("global projection", () => {
  const global: ReaderScope = { kind: "global" };

  it("shows an edge without any book state as a global-only edge with unmasked metadata", () => {
    const view = details({ books: [], edge: relationship(), scope: global });

    expect(view).toMatchObject({
      effectiveState: null,
      history: [],
      relationship: { category: "family", type: "biological_parent_of", typeHidden: false },
    });
  });

  it("omits an edge whose states all live in disallowed books", () => {
    const view = details({
      books: [book({ id: "book-allowed", position: FINISHED })],
      edge: relationship({ bookStates: [state({ bookId: "book-future" })] }),
      scope: global,
    });

    expect(view).toBeNull();
  });

  it("omits an edge whose only allowed state is not permitted", () => {
    const view = details({
      books: [book({ id: "book-a" })],
      edge: relationship({ bookStates: [state({ bookId: "book-a", introducedPage: 3 })] }),
      scope: global,
    });

    expect(view).toBeNull();
  });

  it("masks the edge type and every intensity when any permitted state is a type spoiler", () => {
    const view = details({
      books: [book({ id: "book-a" }), book({ id: "book-b" })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-a", intensity: "high" }),
          state({ bookId: "book-b", intensity: "low", isTypeSpoiler: true }),
        ],
      }),
      scope: global,
    });

    expect(view?.relationship).toMatchObject({
      category: null,
      customType: null,
      directionality: null,
      isCanonical: null,
      sourceLabel: null,
      targetLabel: null,
      type: null,
      typeHidden: true,
    });
    expect(view?.history.map((entry) => entry.intensity)).toEqual([null, null]);
  });

  it("does not let an omitted type-spoiler state mask the edge type", () => {
    const view = details({
      books: [book({ id: "book-a" }), book({ id: "book-b" })],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-a", intensity: "high" }),
          state({ bookId: "book-b", hideRelationshipAsSpoiler: true, isTypeSpoiler: true }),
        ],
      }),
      scope: global,
    });

    expect(view?.relationship).toMatchObject({ type: "biological_parent_of", typeHidden: false });
    expect(view?.history.map((entry) => entry.bookId)).toEqual(["book-a"]);
  });

  it("never manufactures a global effective state", () => {
    const view = details({
      books: [book({ id: "book-a" })],
      edge: relationship({ bookStates: [state({ bookId: "book-a" })] }),
      scope: global,
    });

    expect(view?.effectiveState).toBeNull();
    expect(view?.history).toHaveLength(1);
  });

  it("orders summaries series books by part number with nulls last, then title, then id, standalone books after", () => {
    const books = [
      book({ id: "book-solo-0", title: "Beta" }),
      book({ id: "book-s-p2", partNumber: 2, seriesId: "s-1", title: "Clash" }),
      book({ id: "book-solo-2", title: "Alpha" }),
      book({ id: "book-s-none", partNumber: null, seriesId: "s-1", title: "Appendix" }),
      book({ id: "book-solo-1", title: "Alpha" }),
      book({ id: "book-s-p1", partNumber: 1, seriesId: "s-1", title: "Game" }),
    ];
    const view = details({
      books,
      edge: relationship({ bookStates: books.map((entry) => state({ bookId: entry.id })) }),
      scope: global,
    });

    expect(view?.history.map((entry) => entry.bookId)).toEqual([
      "book-s-p1",
      "book-s-p2",
      "book-s-none",
      "book-solo-1",
      "book-solo-2",
      "book-solo-0",
    ]);
  });
});

describe("visibleChangedAt", () => {
  it("does not move when only a hidden state is updated", () => {
    const books = [book({ id: "book-a" }), book({ id: "book-b" })];
    const edgeWith = (hiddenUpdatedAt: Date): RelationshipFixture =>
      relationship({
        bookStates: [
          state({ bookId: "book-a" }),
          state({ bookId: "book-b", hideRelationshipAsSpoiler: true, updatedAt: hiddenUpdatedAt }),
        ],
      });

    const before = details({ books, edge: edgeWith(CREATED_AT), scope: { kind: "global" } });
    const after = details({ books, edge: edgeWith(HIDDEN_UPDATED_AT), scope: { kind: "global" } });

    expect(before?.relationship.visibleChangedAt).toBe(STATE_UPDATED_AT.toISOString());
    expect(after?.relationship.visibleChangedAt).toBe(STATE_UPDATED_AT.toISOString());
  });

  it.each([
    {
      expected: CREATED_AT,
      name: "ignores both the edge and the state update while the type is hidden",
      stateOverrides: { isTypeSpoiler: true },
    },
    {
      expected: EDGE_UPDATED_AT,
      name: "ignores the update of a description-spoiler state",
      stateOverrides: { isDescriptionSpoiler: true },
    },
    {
      expected: EDGE_UPDATED_AT,
      name: "ignores the update of a state whose end is not yet reached",
      stateOverrides: { endedPage: 500 },
    },
    {
      expected: STATE_UPDATED_AT,
      name: "follows the update of a fully unmasked state",
      stateOverrides: {},
    },
  ] satisfies {
    expected: Date;
    name: string;
    stateOverrides: Partial<RelationshipBookStateSource>;
  }[])("$name", ({ expected, stateOverrides }) => {
    const view = directDetails({ position: atPage(10), stateOverrides });

    expect(view?.relationship.visibleChangedAt).toBe(expected.toISOString());
  });

  it("is not changed by a type reveal", () => {
    const books = [book({ id: "book-a", position: FINISHED })];
    const edge = relationship({ bookStates: [state({ bookId: "book-a", isTypeSpoiler: true })] });
    const scope: ReaderScope = { bookId: "book-a", kind: "direct" };

    const masked = details({ books, edge, scope });
    const revealed = details({
      books,
      edge,
      reveal: { descriptionBookStateId: null, type: true },
      scope,
    });

    expect(revealed?.relationship.visibleChangedAt).toBe(masked?.relationship.visibleChangedAt);
    expect(revealed?.relationship.visibleChangedAt).toBe(CREATED_AT.toISOString());
  });
});

describe("reveal", () => {
  const spoilerState = state({
    bookId: "book-a",
    description: "secret twin",
    intensity: "high",
    isDescriptionSpoiler: true,
    isTypeSpoiler: true,
  });
  const books = [book({ id: "book-a", position: FINISHED })];
  const scope: ReaderScope = { bookId: "book-a", kind: "direct" };

  it("masks the type, intensity and description without a reveal", () => {
    const view = details({ books, edge: relationship({ bookStates: [spoilerState] }), scope });

    expect(view?.relationship).toMatchObject({
      directionality: null,
      type: null,
      typeHidden: true,
    });
    expect(view?.effectiveState).toMatchObject({
      description: null,
      descriptionHidden: true,
      intensity: null,
    });
    expect(JSON.stringify(view)).not.toContain("secret twin");
  });

  it("reveals the type and intensity but not the description", () => {
    const view = details({
      books,
      edge: relationship({ bookStates: [spoilerState] }),
      reveal: { descriptionBookStateId: null, type: true },
      scope,
    });

    expect(view?.relationship).toMatchObject({
      category: "family",
      directionality: "directed",
      isCanonical: true,
      sourceLabel: "parent",
      targetLabel: "child",
      type: "biological_parent_of",
      typeHidden: false,
    });
    expect(view?.effectiveState).toMatchObject({
      description: null,
      descriptionHidden: true,
      intensity: "high",
    });
  });

  it("reveals only the requested state description and leaves the type masked", () => {
    const view = details({
      books: [
        book({ id: "book-p1", partNumber: 1, position: FINISHED }),
        book({ id: "book-p2", partNumber: 2, position: FINISHED }),
      ],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-p1", description: "first secret", isDescriptionSpoiler: true }),
          state({
            bookId: "book-p2",
            description: "second secret",
            isDescriptionSpoiler: true,
            isTypeSpoiler: true,
          }),
        ],
      }),
      reveal: { descriptionBookStateId: "state-book-p1", type: false },
      scope: { contextBookId: "book-p2", kind: "as_of" },
    });

    expect(view?.history).toEqual([
      expect.objectContaining({
        bookId: "book-p1",
        description: "first secret",
        descriptionHidden: false,
      }),
      expect.objectContaining({ bookId: "book-p2", description: null, descriptionHidden: true }),
    ]);
    expect(view?.effectiveState).toMatchObject({ description: null, descriptionHidden: true });
    expect(view?.relationship).toMatchObject({ type: null, typeHidden: true });
  });

  it("does not flag a whitespace-only spoiler description as hidden", () => {
    const view = directDetails({
      position: FINISHED,
      stateOverrides: { description: "   ", isDescriptionSpoiler: true },
    });

    expect(view?.effectiveState).toMatchObject({ description: "   ", descriptionHidden: false });
  });

  it("treats only permitted states as revealable", () => {
    const projection = requireProjection({
      books: [
        book({ id: "book-p1", partNumber: 1, position: FINISHED }),
        book({ id: "book-p2", partNumber: 2, position: FINISHED }),
      ],
      edge: relationship({
        bookStates: [
          state({ bookId: "book-p1", hideRelationshipAsSpoiler: true }),
          state({ bookId: "book-p2" }),
          state({ bookId: "book-p3" }),
        ],
      }),
      scope: { contextBookId: "book-p2", kind: "as_of" },
    });

    expect(isPermittedBookState({ bookStateId: "state-book-p2", projection })).toBe(true);
    expect(isPermittedBookState({ bookStateId: "state-book-p1", projection })).toBe(false);
    expect(isPermittedBookState({ bookStateId: "state-book-p3", projection })).toBe(false);
  });
});

describe("legacy context view", () => {
  it("fills the legacy updatedAt keys with visible timestamps only", () => {
    const edge = relationship({
      bookStates: [
        state({ bookId: "book-a", endedPage: 90, isTypeSpoiler: true, status: "ended" }),
      ],
    });
    const projection = requireProjection({
      books: [book({ id: "book-a", position: atPage(10) })],
      edge,
      scope: { bookId: "book-a", kind: "direct" },
    });

    const view = toSafeRelationshipContextView({
      includeHistory: false,
      projection,
      relationship: edge,
    });

    expect(view.relationship).toMatchObject({
      directionality: null,
      isCanonical: null,
      updatedAt: CREATED_AT.toISOString(),
    });
    expect(view.effectiveState).toMatchObject({
      endedPage: null,
      status: null,
      updatedAt: CREATED_AT.toISOString(),
    });
    expect(view.history).toEqual([]);
  });
});

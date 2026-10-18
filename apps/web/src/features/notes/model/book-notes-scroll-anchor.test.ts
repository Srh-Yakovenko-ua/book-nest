import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookNotesScrollAnchor } from "./book-notes-scroll-anchor";

import {
  captureBookNotesScrollAnchor,
  resolveBookNotesScrollTop,
} from "./book-notes-scroll-anchor";

type CardLayout = { id: string; top: number };

const CARD_HEIGHT = 100;

const SCOPE = { bookId: "book-1", criteriaKey: '{"book":"book-1"}' } as const;

const ANCHOR: BookNotesScrollAnchor = {
  ...SCOPE,
  neighbours: [
    { noteId: "note-4", offset: 50 },
    { noteId: "note-2", offset: -150 },
  ],
  noteId: "note-3",
  offset: -50,
  scrollY: 1200,
};

function layOutCards(cards: readonly CardLayout[]): HTMLUListElement {
  const list = document.createElement("ul");
  for (const card of cards) {
    const item = document.createElement("li");
    item.setAttribute("data-note-id", card.id);
    vi.spyOn(item, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, card.top, 600, CARD_HEIGHT),
    );
    list.append(item);
  }
  return list;
}

function stackedCards(firstTop: number, count: number): CardLayout[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `note-${index + 1}`,
    top: firstTop + index * CARD_HEIGHT,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("captureBookNotesScrollAnchor", () => {
  it("anchors the topmost card still crossing the viewport and keeps its nearest neighbours", () => {
    const container = layOutCards(stackedCards(-250, 7));

    expect(captureBookNotesScrollAnchor({ container, scope: SCOPE, scrollY: 900 })).toEqual({
      ...SCOPE,
      neighbours: [
        { noteId: "note-4", offset: 50 },
        { noteId: "note-2", offset: -150 },
        { noteId: "note-5", offset: 150 },
        { noteId: "note-1", offset: -250 },
        { noteId: "note-6", offset: 250 },
      ],
      noteId: "note-3",
      offset: -50,
      scrollY: 900,
    });
  });

  it("anchors the last card when every card is above the viewport", () => {
    const container = layOutCards(stackedCards(-500, 3));

    const anchor = captureBookNotesScrollAnchor({ container, scope: SCOPE, scrollY: 2000 });

    expect(anchor?.noteId).toBe("note-3");
    expect(anchor?.offset).toBe(-300);
  });

  it("has nothing to anchor before any card is rendered", () => {
    const container = layOutCards([]);

    expect(captureBookNotesScrollAnchor({ container, scope: SCOPE, scrollY: 0 })).toBeNull();
  });
});

describe("resolveBookNotesScrollTop", () => {
  it("puts the anchored note back at its saved offset from the viewport top", () => {
    const container = layOutCards([
      { id: "note-2", top: 300 },
      { id: "note-3", top: 400 },
    ]);

    expect(resolveBookNotesScrollTop({ anchor: ANCHOR, container, scope: SCOPE, scrollY: 0 })).toBe(
      450,
    );
  });

  it("falls back to the nearest rendered neighbour when the anchored note is gone", () => {
    const container = layOutCards([
      { id: "note-2", top: 100 },
      { id: "note-4", top: 300 },
    ]);

    expect(
      resolveBookNotesScrollTop({ anchor: ANCHOR, container, scope: SCOPE, scrollY: 40 }),
    ).toBe(290);
  });

  it("falls back to the saved scroll position when no nearby note is rendered", () => {
    const container = layOutCards([{ id: "note-40", top: 0 }]);

    expect(resolveBookNotesScrollTop({ anchor: ANCHOR, container, scope: SCOPE, scrollY: 0 })).toBe(
      1200,
    );
  });

  it("ignores an anchor saved for another book or other criteria", () => {
    const container = layOutCards([{ id: "note-3", top: 400 }]);

    expect(
      resolveBookNotesScrollTop({
        anchor: ANCHOR,
        container,
        scope: { ...SCOPE, bookId: "book-2" },
        scrollY: 0,
      }),
    ).toBeNull();
    expect(
      resolveBookNotesScrollTop({
        anchor: ANCHOR,
        container,
        scope: { ...SCOPE, criteriaKey: '{"book":"book-1","filter":"favorite"}' },
        scrollY: 0,
      }),
    ).toBeNull();
  });
});

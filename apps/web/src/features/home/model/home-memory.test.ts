import type { NoteMemoryBookSource, NoteMemoryView, Nullable, QuoteView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeBookNote } from "@/features/notes/model/notes.fixtures";
import { makeQuote } from "@/features/quotes/model/quotes.fixtures";

import type { HomeMemoryKind, HomeMemorySource, HomeNoteMemory } from "./home-memory";

import {
  bookMemoryNote,
  homeMemoryPresence,
  memoryKindForDay,
  memorySourceFromQuery,
  selectHomeMemory,
} from "./home-memory";

const MEMORY_DAYS = { first: "2026-11-24", second: "2026-11-25" } as const;

const BOOK_SOURCE: NoteMemoryBookSource = {
  authors: [{ id: "5d1c0e7a-3f3b-4c55-9d1e-2b7f4a8c9e01", name: "Френк Герберт" }],
  cover: null,
  id: "8f0a6b2e-1c4d-4e7f-a9b3-6d2c5e8f1a04",
  seriesPosition: 1,
  title: "Дюна",
  type: "book",
};

const NOTE_MEMORY: HomeNoteMemory = {
  impressionKey: "note-impression-1",
  note: makeBookNote(),
  source: BOOK_SOURCE,
};

const QUOTE: QuoteView = makeQuote();

function confirmed<TItem>(item: Nullable<TItem>): HomeMemorySource<TItem> {
  return { item, status: "success" };
}

function dayPreferring(kind: HomeMemoryKind): string {
  return memoryKindForDay(MEMORY_DAYS.first) === kind ? MEMORY_DAYS.first : MEMORY_DAYS.second;
}

describe("memoryKindForDay", () => {
  it.each([
    ["2026-11-24", "2026-11-25"],
    ["2026-01-31", "2026-02-01"],
    ["2026-02-28", "2026-03-01"],
    ["2026-03-31", "2026-04-01"],
    ["2026-12-31", "2027-01-01"],
    ["2025-12-31", "2026-01-01"],
  ] as const)("shows a different kind on %s and the next day %s", (day, nextDay) => {
    expect(memoryKindForDay(nextDay)).not.toBe(memoryKindForDay(day));
  });

  it("returns to the same kind two days later across a month end", () => {
    expect(memoryKindForDay("2026-02-01")).toBe(memoryKindForDay("2026-01-30"));
  });
});

describe("selectHomeMemory", () => {
  it("shows the quote on a quote day when one exists", () => {
    expect(
      selectHomeMemory({
        note: confirmed(NOTE_MEMORY),
        quote: confirmed(QUOTE),
        today: dayPreferring("quote"),
      }),
    ).toEqual({ kind: "quote", quote: QUOTE });
  });

  it("shows the note on a note day when one exists", () => {
    expect(
      selectHomeMemory({
        note: confirmed(NOTE_MEMORY),
        quote: confirmed(QUOTE),
        today: dayPreferring("note"),
      }),
    ).toEqual({ kind: "note", memory: NOTE_MEMORY });
  });

  it("falls back to the note when the quote of a quote day is confirmed missing", () => {
    expect(
      selectHomeMemory({
        note: confirmed(NOTE_MEMORY),
        quote: confirmed<QuoteView>(null),
        today: dayPreferring("quote"),
      }),
    ).toEqual({ kind: "note", memory: NOTE_MEMORY });
  });

  it("falls back to the quote when the note of a note day is confirmed missing", () => {
    expect(
      selectHomeMemory({
        note: confirmed<HomeNoteMemory>(null),
        quote: confirmed(QUOTE),
        today: dayPreferring("note"),
      }),
    ).toEqual({ kind: "quote", quote: QUOTE });
  });

  it.each([["quote"], ["note"]] as const)(
    "hides the card on a %s day when both kinds are confirmed missing",
    (kind) => {
      expect(
        selectHomeMemory({
          note: confirmed<HomeNoteMemory>(null),
          quote: confirmed<QuoteView>(null),
          today: dayPreferring(kind),
        }),
      ).toEqual({ kind: "hidden" });
    },
  );

  it("reports an error when the quote is missing and the note failed", () => {
    expect(
      selectHomeMemory({
        note: { status: "error" },
        quote: confirmed<QuoteView>(null),
        today: dayPreferring("quote"),
      }),
    ).toEqual({ kind: "error" });
  });

  it("reports an error when the note is missing and the quote failed", () => {
    expect(
      selectHomeMemory({
        note: confirmed<HomeNoteMemory>(null),
        quote: { status: "error" },
        today: dayPreferring("quote"),
      }),
    ).toEqual({ kind: "error" });
  });

  it("is loading while the kind of the day is still pending", () => {
    expect(
      selectHomeMemory({
        note: confirmed(NOTE_MEMORY),
        quote: { status: "pending" },
        today: dayPreferring("quote"),
      }),
    ).toEqual({ kind: "loading" });
  });

  it("is loading while the fallback is pending after the kind of the day came back empty", () => {
    expect(
      selectHomeMemory({
        note: { status: "pending" },
        quote: confirmed<QuoteView>(null),
        today: dayPreferring("quote"),
      }),
    ).toEqual({ kind: "loading" });
  });
});

describe("memorySourceFromQuery", () => {
  const pick = (data: { memory: Nullable<QuoteView> }) => data.memory;

  it("is pending before the first response", () => {
    expect(memorySourceFromQuery({ pick, query: { data: undefined, isError: false } })).toEqual({
      status: "pending",
    });
  });

  it("is an error when the first request fails", () => {
    expect(memorySourceFromQuery({ pick, query: { data: undefined, isError: true } })).toEqual({
      status: "error",
    });
  });

  it("counts cached data as success while a refetch is failing", () => {
    expect(
      memorySourceFromQuery({ pick, query: { data: { memory: QUOTE }, isError: true } }),
    ).toEqual({ item: QUOTE, status: "success" });
  });

  it("counts a response without an item as a confirmed absence", () => {
    expect(
      memorySourceFromQuery({ pick, query: { data: { memory: null }, isError: false } }),
    ).toEqual({ item: null, status: "success" });
  });
});

describe("bookMemoryNote", () => {
  it("keeps a note that belongs to a book", () => {
    const memoryNote: NoteMemoryView = NOTE_MEMORY;

    expect(bookMemoryNote({ memoryNote })).toEqual(NOTE_MEMORY);
  });

  it("excludes a note that belongs to a series", () => {
    const memoryNote: NoteMemoryView = {
      impressionKey: "note-impression-2",
      note: makeBookNote(),
      source: { id: "3b9d7c1a-6e2f-4a8b-b5c4-0f1e2d3c4b5a", title: "Дюна", type: "series" },
    };

    expect(bookMemoryNote({ memoryNote })).toBeNull();
  });

  it("returns nothing when there is no memory note", () => {
    expect(bookMemoryNote({ memoryNote: null })).toBeNull();
  });
});

describe("homeMemoryPresence", () => {
  it.each([
    ["quote", { kind: "quote", quote: QUOTE }, "present"],
    ["note", { kind: "note", memory: NOTE_MEMORY }, "present"],
    ["hidden", { kind: "hidden" }, "absent"],
    ["error", { kind: "error" }, "unknown"],
    ["loading", { kind: "loading" }, "unknown"],
  ] as const)("maps a %s selection to %s", (_kind, selection, expected) => {
    expect(homeMemoryPresence(selection)).toBe(expected);
  });
});

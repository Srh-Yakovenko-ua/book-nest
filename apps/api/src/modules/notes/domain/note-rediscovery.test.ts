import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NoteRediscoveryCandidate } from "./note-rediscovery.js";

import { addDaysToIsoDate } from "../../../core/iso-date.js";
import {
  BOOKS_REDISCOVERY_SCOPE,
  decodeNoteImpressionKey,
  encodeNoteImpressionKey,
  noteSourceKeyOf,
  parseSeriesContextKey,
  selectMemoryNoteId,
  seriesRediscoveryScope,
} from "./note-rediscovery.js";

const TODAY = "2026-09-10";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const SERIES_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_SERIES_ID = "44444444-4444-4444-8444-444444444444";

function candidate(
  id: string,
  overrides: Partial<Omit<NoteRediscoveryCandidate, "id">> = {},
): NoteRediscoveryCandidate {
  return {
    createdOn: addDaysToIsoDate(TODAY, -40),
    id,
    isFavorite: false,
    isPinned: false,
    lastShownOn: null,
    sourceKey: noteSourceKeyOf({ id: `book-${id}`, type: "book" }),
    ...overrides,
  };
}

function pick(candidates: NoteRediscoveryCandidate[], localDate = TODAY): Nullable<string> {
  return selectMemoryNoteId({
    candidates,
    lastSourceKey: null,
    localDate,
    scope: BOOKS_REDISCOVERY_SCOPE,
    userId: USER_ID,
  });
}

describe("selectMemoryNoteId", () => {
  it("returns null while fewer than two notes qualify", () => {
    expect(pick([candidate("a")])).toBeNull();
  });

  it("lets favorite and pinned notes push plain ones out of the top pool", () => {
    const flagged = [
      candidate("pinned-favorite", { isFavorite: true, isPinned: true }),
      candidate("favorite", { isFavorite: true }),
      candidate("pinned", { isPinned: true }),
    ];
    const plain = Array.from({ length: 10 }, (_unused, index) => candidate(`plain-${index}`));
    const pushedOut = new Set(["plain-7", "plain-8", "plain-9"]);

    const picks = Array.from({ length: 60 }, (_unused, offset) =>
      pick([...flagged, ...plain], addDaysToIsoDate(TODAY, offset)),
    );

    expect(picks.some((picked) => picked !== null && pushedOut.has(picked))).toBe(false);
  });

  it("gives two surfaces of the same reader independent daily picks", () => {
    const candidates = Array.from({ length: 10 }, (_unused, index) => candidate(`note-${index}`));
    const picks = new Set(
      Array.from({ length: 20 }, (_unused, index) =>
        selectMemoryNoteId({
          candidates,
          lastSourceKey: null,
          localDate: TODAY,
          scope: { contextKey: `context-${index}`, surface: "books" },
          userId: USER_ID,
        }),
      ),
    );

    expect(picks.size).toBeGreaterThan(1);
  });
});

describe("note impression key", () => {
  it("round-trips the surface, context and note", () => {
    const key = encodeNoteImpressionKey({ ...BOOKS_REDISCOVERY_SCOPE, noteId: NOTE_ID });

    expect(decodeNoteImpressionKey(key)).toEqual({ ...BOOKS_REDISCOVERY_SCOPE, noteId: NOTE_ID });
  });

  it.each(["", "not-a-key", Buffer.from('{"surface":"quotes"}').toString("base64url")])(
    "rejects the malformed key %j",
    (key) => {
      expect(decodeNoteImpressionKey(key)).toBeNull();
    },
  );

  it("keys a source by its type and id", () => {
    expect(noteSourceKeyOf({ id: "abc", type: "series" })).toBe("series:abc");
    expect(noteSourceKeyOf({ id: "abc", type: "book" })).toBe("book:abc");
  });
});

describe("series memory selection", () => {
  function pickInSeries({
    candidates,
    lastSourceKey = null,
    localDate = TODAY,
    seriesId = SERIES_ID,
  }: {
    candidates: NoteRediscoveryCandidate[];
    lastSourceKey?: Nullable<string>;
    localDate?: string;
    seriesId?: string;
  }): Nullable<string> {
    return selectMemoryNoteId({
      candidates,
      lastSourceKey,
      localDate,
      scope: seriesRediscoveryScope(seriesId),
      userId: USER_ID,
    });
  }

  it("SERIES-MEM-05 keys the context by series so two series pick independently", () => {
    const candidates = Array.from({ length: 10 }, (_unused, index) => candidate(`note-${index}`));
    const days = Array.from({ length: 20 }, (_unused, offset) => addDaysToIsoDate(TODAY, offset));

    const differs = days.some(
      (localDate) =>
        pickInSeries({ candidates, localDate }) !==
        pickInSeries({ candidates, localDate, seriesId: OTHER_SERIES_ID }),
    );

    expect(seriesRediscoveryScope(SERIES_ID)).toEqual({ contextKey: SERIES_ID, surface: "series" });
    expect(differs).toBe(true);
  });

  it("SERIES-MEM-06 prefers a fresh source only inside the highest-score cohort", () => {
    const seriesSource = noteSourceKeyOf({ id: SERIES_ID, type: "series" });
    const sameScore = [
      candidate("series-note", { sourceKey: seriesSource }),
      candidate("book-note", { sourceKey: "book:one" }),
    ];
    const days = Array.from({ length: 30 }, (_unused, offset) => addDaysToIsoDate(TODAY, offset));

    for (const localDate of days) {
      expect(pickInSeries({ candidates: sameScore, lastSourceKey: seriesSource, localDate })).toBe(
        "book-note",
      );
    }

    const strongerRepeat = [
      candidate("series-favorite", { isFavorite: true, isPinned: true, sourceKey: seriesSource }),
      candidate("book-plain", { sourceKey: "book:one" }),
    ];
    const picks = days.map((localDate) =>
      pickInSeries({ candidates: strongerRepeat, lastSourceKey: seriesSource, localDate }),
    );
    expect(picks).toContain("series-favorite");
  });

  it("accepts only a uuid as the series context key", () => {
    expect(parseSeriesContextKey(SERIES_ID)).toBe(SERIES_ID);
    expect(parseSeriesContextKey("all")).toBeNull();
  });
});

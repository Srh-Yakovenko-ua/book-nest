import { describe, expect, it } from "vitest";

import type { NoteAuthorLink, NoteEntityCount } from "./note-facets.js";

import { buildSeriesNotesSummary } from "./series-notes-summary.js";

const LE_GUIN = { id: "author-le-guin", name: "Ursula Le Guin" };
const COREY = { id: "author-corey", name: "James S. A. Corey" };
const COREY_NAMESAKE = { id: "author-corey-namesake", name: "James S. A. Corey" };

function link(entityId: string, author: { id: string; name: string }): NoteAuthorLink {
  return { author, entityId };
}

function seriesCount(entityId: string, count: number): NoteEntityCount {
  return { count, entityId, label: `Name of ${entityId}` };
}

describe("buildSeriesNotesSummary", () => {
  it("counts a series with exactly three notes as 3+ and two as not", () => {
    const summary = buildSeriesNotesSummary({
      authorLinks: [],
      createdLast30DaysCount: 1,
      seriesCounts: [seriesCount("earthsea", 3), seriesCount("expanse", 2)],
    });

    expect(summary.seriesNotesCount).toBe(5);
    expect(summary.seriesWithNotesCount).toBe(2);
    expect(summary.seriesWithThreeOrMoreNotesCount).toBe(1);
    expect(summary.createdLast30DaysCount).toBe(1);
  });

  it("credits the whole series count to every canonical author", () => {
    const summary = buildSeriesNotesSummary({
      authorLinks: [link("expanse", COREY), link("expanse", LE_GUIN), link("earthsea", LE_GUIN)],
      createdLast30DaysCount: 0,
      seriesCounts: [seriesCount("expanse", 4), seriesCount("earthsea", 2)],
    });

    expect(summary.topAuthor).toEqual({ leadersCount: 1, name: "Ursula Le Guin", notesCount: 6 });
  });

  it("groups authors by id, so namesakes tie instead of merging", () => {
    const summary = buildSeriesNotesSummary({
      authorLinks: [link("expanse", COREY), link("other", COREY_NAMESAKE)],
      createdLast30DaysCount: 0,
      seriesCounts: [seriesCount("expanse", 2), seriesCount("other", 2)],
    });

    expect(summary.topAuthor).toEqual({ leadersCount: 2, name: null, notesCount: 2 });
  });

  it("reports a series tie with a leaders count and no name", () => {
    const summary = buildSeriesNotesSummary({
      authorLinks: [],
      createdLast30DaysCount: 0,
      seriesCounts: [seriesCount("earthsea", 2), seriesCount("expanse", 2)],
    });

    expect(summary.topSeries).toEqual({ leadersCount: 2, name: null, notesCount: 2 });
    expect(summary.topAuthor).toBeNull();
  });

  it("exposes the all-ones case as every series leading with one note", () => {
    const summary = buildSeriesNotesSummary({
      authorLinks: [],
      createdLast30DaysCount: 0,
      seriesCounts: [seriesCount("earthsea", 1), seriesCount("expanse", 1)],
    });

    expect(summary.topSeries).toEqual({ leadersCount: 2, name: null, notesCount: 1 });
    expect(summary.seriesWithNotesCount).toBe(2);
  });

  it("names the unique top series", () => {
    const summary = buildSeriesNotesSummary({
      authorLinks: [],
      createdLast30DaysCount: 0,
      seriesCounts: [seriesCount("earthsea", 3)],
    });

    expect(summary.topSeries).toEqual({
      leadersCount: 1,
      name: "Name of earthsea",
      notesCount: 3,
    });
  });
});

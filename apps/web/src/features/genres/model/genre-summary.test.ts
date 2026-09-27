import { describe, expect, it } from "vitest";

import { genreLeaderFact, usedGenresFact } from "./genre-summary";
import { makeGenreSummary, makeSummaryGenre } from "./genres.fixtures";

const FANTASY = makeSummaryGenre();
const ROMANCE = makeSummaryGenre({ key: "romance", label: "Романтика" });
const MYSTERY = makeSummaryGenre({ key: "mystery", label: "Детектив" });

describe("usedGenresFact", () => {
  it("names the number of books that carry genres", () => {
    expect(usedGenresFact(makeGenreSummary())).toEqual({ booksCount: 124, kind: "inBooks" });
  });

  it("says the library is empty before any book exists", () => {
    expect(
      usedGenresFact(makeGenreSummary({ booksWithGenresCount: 0, libraryBooksCount: 0 })),
    ).toEqual({ kind: "missing", reason: "emptyLibrary" });
  });

  it("says genres are missing when books exist without them", () => {
    expect(usedGenresFact(makeGenreSummary({ booksWithGenresCount: 0 }))).toEqual({
      kind: "missing",
      reason: "noGenresOnBooks",
    });
  });
});

describe("genreLeaderFact", () => {
  it("shows a single leader", () => {
    expect(genreLeaderFact(makeGenreSummary(), "mostFrequent")).toEqual({
      hiddenLeadersCount: 0,
      kind: "leaders",
      leaders: [FANTASY],
    });
  });

  it("shows at most two tied leaders and keeps the rest as a count", () => {
    const summary = makeGenreSummary({
      mostRead: { leaders: [FANTASY, ROMANCE, MYSTERY], leadersCount: 4 },
    });

    expect(genreLeaderFact(summary, "mostRead")).toEqual({
      hiddenLeadersCount: 2,
      kind: "leaders",
      leaders: [FANTASY, ROMANCE],
    });
  });

  it("reports an empty library for every leader card", () => {
    expect(genreLeaderFact(makeGenreSummary({ libraryBooksCount: 0 }), "highestRated")).toEqual({
      kind: "missing",
      reason: "emptyLibrary",
    });
  });

  it("tells apart no ratings, ratings without genres and a too-small sample", () => {
    const noLeader = { highestRated: null };

    expect(
      genreLeaderFact(makeGenreSummary({ ...noLeader, ratedBooksCount: 0 }), "highestRated"),
    ).toEqual({ kind: "missing", reason: "noRatings" });
    expect(
      genreLeaderFact(
        makeGenreSummary({ ...noLeader, ratedBooksWithGenresCount: 0 }),
        "highestRated",
      ),
    ).toEqual({ kind: "missing", reason: "noRatedWithGenres" });
    expect(genreLeaderFact(makeGenreSummary(noLeader), "highestRated")).toEqual({
      kind: "missing",
      reason: "ratingSampleTooSmall",
    });
  });

  it("tells an empty queue apart from queued books without genres", () => {
    expect(
      genreLeaderFact(makeGenreSummary({ mostQueued: null, queuedBooksCount: 0 }), "mostQueued"),
    ).toEqual({ kind: "missing", reason: "queueEmpty" });
    expect(
      genreLeaderFact(
        makeGenreSummary({ mostQueued: null, queuedBooksWithGenresCount: 0 }),
        "mostQueued",
      ),
    ).toEqual({ kind: "missing", reason: "queueWithoutGenres" });
  });

  it("tells no finished books apart from finished books without genres", () => {
    expect(
      genreLeaderFact(makeGenreSummary({ finishedBooksCount: 0, mostRead: null }), "mostRead"),
    ).toEqual({ kind: "missing", reason: "noFinished" });
    expect(
      genreLeaderFact(
        makeGenreSummary({ finishedBooksWithGenresCount: 0, mostRead: null }),
        "mostRead",
      ),
    ).toEqual({ kind: "missing", reason: "finishedWithoutGenres" });
  });

  it("tells no wishlist apart from wishlisted books without genres", () => {
    expect(
      genreLeaderFact(
        makeGenreSummary({ mostWantedToBuy: null, wantToBuyBooksCount: 0 }),
        "mostWantedToBuy",
      ),
    ).toEqual({ kind: "missing", reason: "noWantToBuy" });
    expect(
      genreLeaderFact(
        makeGenreSummary({ mostWantedToBuy: null, wantToBuyBooksWithGenresCount: 0 }),
        "mostWantedToBuy",
      ),
    ).toEqual({ kind: "missing", reason: "wantToBuyWithoutGenres" });
  });

  it("says genres are missing when books exist but no genre leads", () => {
    expect(genreLeaderFact(makeGenreSummary({ mostFrequent: null }), "mostFrequent")).toEqual({
      kind: "missing",
      reason: "noGenresOnBooks",
    });
  });
});

import type { SeriesPublisherRef } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { PublisherSelection, SeriesSelection } from "./create-book-form";

import { resolveSeriesPublisherSuggestion } from "./series-publisher-suggestion";

const vivat: SeriesPublisherRef = { bookCount: 5, id: "publisher-1", name: "Vivat" };

function existingSeries(dominantPublisher: null | SeriesPublisherRef): SeriesSelection {
  return {
    authors: [],
    dominantPublisher,
    genres: [],
    id: "series-1",
    kind: "existing",
    name: "Емпіреї",
  };
}

function newSeries(): SeriesSelection {
  return {
    authors: [],
    draft: { genres: [], name: "Нова серія", status: "unknown" },
    kind: "new",
    name: "Нова серія",
  };
}

function resolve(overrides: {
  isPublisherEdited?: boolean;
  publisherSelection?: null | PublisherSelection;
  seriesSelection?: null | SeriesSelection;
}) {
  return resolveSeriesPublisherSuggestion({
    isPublisherEdited: overrides.isPublisherEdited ?? false,
    publisherSelection: overrides.publisherSelection ?? null,
    seriesSelection:
      overrides.seriesSelection === undefined ? existingSeries(vivat) : overrides.seriesSelection,
  });
}

describe("resolveSeriesPublisherSuggestion", () => {
  it("suggests the dominant publisher of the picked series", () => {
    expect(resolve({})).toEqual({
      bookCount: 5,
      kind: "apply",
      publisher: { id: "publisher-1", kind: "catalog", name: "Vivat" },
    });
  });

  it("suggests nothing when the publisher field already holds a value", () => {
    expect(
      resolve({ publisherSelection: { id: "publisher-9", kind: "catalog", name: "Ранок" } }),
    ).toEqual({ kind: "none" });
  });

  it("suggests nothing when the publisher field was edited and then cleared", () => {
    expect(resolve({ isPublisherEdited: true, publisherSelection: null })).toEqual({
      kind: "none",
    });
  });

  it("keeps an edited publisher ahead of the series dominant publisher", () => {
    expect(
      resolve({
        isPublisherEdited: true,
        publisherSelection: { id: "publisher-9", kind: "catalog", name: "Ранок" },
      }),
    ).toEqual({ kind: "none" });
  });

  it("suggests nothing when the series publishers tie", () => {
    expect(resolve({ seriesSelection: existingSeries(null) })).toEqual({ kind: "none" });
  });

  it("suggests nothing without a series", () => {
    expect(resolve({ seriesSelection: null })).toEqual({ kind: "none" });
  });

  it("suggests nothing for a series that is about to be created", () => {
    expect(resolve({ seriesSelection: newSeries() })).toEqual({ kind: "none" });
  });
});

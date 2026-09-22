import type { Nullable } from "@app/shared";

import type { PublisherSelection, SeriesSelection } from "./create-book-form";

export type SeriesPublisherSuggestion =
  { bookCount: number; kind: "apply"; publisher: CatalogPublisherSelection } | { kind: "none" };

type CatalogPublisherSelection = Extract<PublisherSelection, { kind: "catalog" }>;

type SeriesPublisherSuggestionInput = {
  isPublisherEdited: boolean;
  publisherSelection: Nullable<PublisherSelection>;
  seriesSelection: Nullable<SeriesSelection>;
};

const NO_SUGGESTION: SeriesPublisherSuggestion = { kind: "none" };

export function resolveSeriesPublisherSuggestion({
  isPublisherEdited,
  publisherSelection,
  seriesSelection,
}: SeriesPublisherSuggestionInput): SeriesPublisherSuggestion {
  if (isPublisherEdited) return NO_SUGGESTION;
  if (publisherSelection !== null) return NO_SUGGESTION;
  if (seriesSelection === null || seriesSelection.kind !== "existing") return NO_SUGGESTION;

  const dominantPublisher = seriesSelection.dominantPublisher;
  if (dominantPublisher === null) return NO_SUGGESTION;

  return {
    bookCount: dominantPublisher.bookCount,
    kind: "apply",
    publisher: { id: dominantPublisher.id, kind: "catalog", name: dominantPublisher.name },
  };
}

import type { MediaView, Nullable, SeriesView } from "@app/shared";

export type SeriesSelectOption = {
  authors: string[];
  booksCount: number;
  cover: Nullable<MediaView>;
  id: string;
  name: string;
};

export function toSeriesSelectOption(series: SeriesView): SeriesSelectOption {
  return {
    authors: series.authors.map((author) => author.name),
    booksCount: series.booksInSeries,
    cover: series.covers[0]?.cover ?? null,
    id: series.id,
    name: series.name,
  };
}

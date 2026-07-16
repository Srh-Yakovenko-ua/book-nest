import "@testing-library/jest-dom/vitest";

import type { SeriesBookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makeSeriesBookView, makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesBooksSummary } from "./series-books-summary";

function renderSummary({
  books,
  totalBooks = 5,
}: {
  books: SeriesBookView[];
  totalBooks?: null | number;
}) {
  return renderWithProviders(
    <SeriesBooksSummary
      details={makeSeriesDetailsView({
        books,
        booksInSeries: books.length,
        totalBooks,
      })}
    />,
  );
}

describe("SeriesBooksSummary", () => {
  it("counts the gaps separately from the unread books it owns", () => {
    renderSummary({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, readingStatus: "finished" }),
        makeSeriesBookView({ id: "b", partNumber: 2, readingStatus: "finished" }),
      ],
      totalBooks: 3,
    });

    expect(screen.getByText("ще 1 не додано")).toBeInTheDocument();
  });

  it("stays silent about gaps when every position is filled", () => {
    renderSummary({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, readingStatus: "finished" }),
        makeSeriesBookView({ id: "b", partNumber: 2, readingStatus: "finished" }),
      ],
      totalBooks: 2,
    });

    expect(screen.queryByText(/не додано/)).not.toBeInTheDocument();
  });
});

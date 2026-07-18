import "@testing-library/jest-dom/vitest";

import type { SeriesDetailsView as SeriesDetailsViewModel } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import {
  makeSeriesBookView,
  makeSeriesDetailsView,
  makeSeriesStats,
} from "../model/series.fixtures";
import { SeriesDetailsView } from "./series-details-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function makeFullyReadSeries(): SeriesDetailsViewModel {
  return makeSeriesDetailsView({
    books: [
      makeSeriesBookView({ id: "b1", partNumber: 1, readingStatus: "finished" }),
      makeSeriesBookView({
        id: "b2",
        partNumber: 2,
        readingStatus: "finished",
        title: "Ковадло зірок",
      }),
    ],
    booksInSeries: 2,
    finishedInSeries: 2,
    nextBook: null,
    readingInSeries: 0,
    stats: makeSeriesStats({ booksCount: 2, finishedCount: 2, readingCount: 0, unreadCount: 0 }),
    status: "completed",
    totalBooks: 2,
  });
}

function renderView(details: SeriesDetailsViewModel) {
  return renderWithProviders(
    <NuqsTestingAdapter>
      <SeriesDetailsView details={details} />
    </NuqsTestingAdapter>,
  );
}

describe("SeriesDetailsView", () => {
  it("hides the progress card once the whole series is read", () => {
    renderView(makeFullyReadSeries());

    expect(screen.queryByText("Ваш прогрес у серії")).not.toBeInTheDocument();
  });

  it("keeps the progress card while the series is unfinished", () => {
    renderView(makeSeriesDetailsView());

    expect(screen.getAllByText("Ваш прогрес у серії").length).toBeGreaterThan(0);
  });

  it("keeps the progress card for an empty series so its empty state stays visible", () => {
    renderView(
      makeSeriesDetailsView({
        books: [],
        booksInSeries: 0,
        finishedInSeries: 0,
        nextBook: null,
        readingInSeries: 0,
        stats: makeSeriesStats({
          averageRating: null,
          booksCount: 0,
          finishedCount: 0,
          pagesCount: null,
          readingCount: 0,
          unreadCount: 0,
        }),
        totalBooks: null,
      }),
    );

    expect(screen.getAllByText("Ваш прогрес у серії").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Прогрес ще недоступний").length).toBeGreaterThan(0);
  });
});

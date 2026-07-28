import "@testing-library/jest-dom/vitest";

import type { SeriesDetailsView as SeriesDetailsViewModel } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/api/genres")) {
        return Promise.resolve(
          new Response("[]", { headers: { "Content-Type": "application/json" } }),
        );
      }
      return Promise.resolve(
        new Response("{}", { headers: { "Content-Type": "application/json" } }),
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  it("shows the completion state once the whole series is read", () => {
    renderView(makeFullyReadSeries());

    expect(screen.getAllByText("Прогрес читання").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Серію прочитано повністю").length).toBeGreaterThan(0);
  });

  it("keeps the progress card while the series is unfinished", () => {
    renderView(makeSeriesDetailsView());

    expect(screen.getAllByText("Прогрес читання").length).toBeGreaterThan(0);
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

    expect(screen.getAllByText("Прогрес читання").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Читання серії ще не розпочато").length).toBeGreaterThan(0);
  });
});

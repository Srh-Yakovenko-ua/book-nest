import "@testing-library/jest-dom/vitest";

import type { SeriesStatsView } from "@app/shared";

import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import enMessages from "@/messages/en.json";
import { render, renderWithProviders, screen, within } from "@/test-utils";

import { makeSeriesStats } from "../model/series.fixtures";
import { SeriesStatsCard } from "./series-stats-card";

function metricColumn(label: string): HTMLElement {
  const dt = screen.getByText(label);
  const column = dt.parentElement;
  if (column === null) throw new Error(`no column for ${label}`);
  return column;
}

function renderCard(stats: SeriesStatsView, totalBooks: null | number = 3) {
  return renderWithProviders(<SeriesStatsCard stats={stats} totalBooks={totalBooks} />);
}

function renderCardEn(stats: SeriesStatsView, totalBooks: null | number = 3) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TooltipProvider>
        <SeriesStatsCard stats={stats} totalBooks={totalBooks} />
      </TooltipProvider>
    </NextIntlClientProvider>,
  );
}

describe("SeriesStatsCard", () => {
  it("shows the four base metrics plus the two highest-priority extras", () => {
    renderCard(
      makeSeriesStats({
        averageRating: 9.8,
        booksCount: 2,
        finishedCount: 2,
        readPagesCount: 848,
        readPagesPartial: false,
      }),
      3,
    );

    expect(within(metricColumn("Усього книг")).getByText("3")).toBeInTheDocument();
    expect(within(metricColumn("У бібліотеці")).getByText("2")).toBeInTheDocument();
    expect(within(metricColumn("Прочитано")).getByText("2")).toBeInTheDocument();
    expect(within(metricColumn("Прочитано сторінок")).getByText("848")).toBeInTheDocument();

    expect(screen.getByRole("img", { name: "9.8/10" })).toBeInTheDocument();
    expect(screen.getByText("Улюблена книга")).toBeInTheDocument();

    expect(screen.queryByText("Останнє завершення")).not.toBeInTheDocument();
    expect(screen.queryByText("Почато серію")).not.toBeInTheDocument();
  });

  it("shows only the four base metrics when no extra data exists", () => {
    renderCard(
      makeSeriesStats({
        averagePages: null,
        averageRating: null,
        favoriteBook: null,
        lastFinishedAt: null,
        readingDurationDays: null,
        startedAt: null,
      }),
    );

    expect(screen.getByText("Усього книг")).toBeInTheDocument();
    expect(screen.getByText("У бібліотеці")).toBeInTheDocument();
    expect(screen.getByText("Прочитано")).toBeInTheDocument();
    expect(screen.getByText("Прочитано сторінок")).toBeInTheDocument();

    expect(screen.queryByText("Середня оцінка книг")).not.toBeInTheDocument();
    expect(screen.queryByText("Улюблена книга")).not.toBeInTheDocument();
    expect(screen.queryByText("Останнє завершення")).not.toBeInTheDocument();
    expect(screen.queryByText("Почато серію")).not.toBeInTheDocument();
    expect(screen.queryByText("У середньому сторінок")).not.toBeInTheDocument();
    expect(screen.queryByText("Прочитано за")).not.toBeInTheDocument();
  });

  it("marks a partial read-pages sum with a plus and an accessible label", () => {
    renderCard(makeSeriesStats({ readPagesCount: 848, readPagesPartial: true }));

    expect(within(metricColumn("Прочитано сторінок")).getByText("848+")).toBeInTheDocument();
    expect(screen.getByLabelText("Відомо щонайменше 848 прочитаних сторінок")).toBeInTheDocument();
  });

  it("shows a dash instead of zero when read pages are unknown", () => {
    renderCard(makeSeriesStats({ readPagesCount: null, readPagesPartial: false }), 3);

    const column = metricColumn("Прочитано сторінок");
    expect(within(column).getByText("—")).toBeInTheDocument();
    expect(within(column).queryByText("0")).not.toBeInTheDocument();
  });

  it("keeps zero counters visible instead of hiding them", () => {
    renderCard(makeSeriesStats({ booksCount: 0, finishedCount: 0 }), 3);

    expect(within(metricColumn("У бібліотеці")).getByText("0")).toBeInTheDocument();
    expect(within(metricColumn("Прочитано")).getByText("0")).toBeInTheDocument();
  });

  it("truncates a long favorite title without breaking the layout", () => {
    const title =
      "Дуже-дуже довга назва улюбленої книги, яка точно не поміститься у вузький сайдбар серії";
    renderCard(
      makeSeriesStats({
        averageRating: null,
        favoriteBook: { id: "fav", title },
      }),
    );

    const value = screen.getByText(title);
    expect(value).toHaveClass("truncate");
  });

  it("renders English labels for the en locale", () => {
    renderCardEn(makeSeriesStats({ averageRating: 8.5 }));

    expect(screen.getByText("Total books")).toBeInTheDocument();
    expect(screen.getByText("In library")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Pages read")).toBeInTheDocument();
    expect(screen.getByText("Average book rating")).toBeInTheDocument();
  });
});

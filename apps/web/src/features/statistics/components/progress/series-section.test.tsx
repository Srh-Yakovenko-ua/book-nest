import type { ReadingStatisticsSeriesSection } from "@app/shared";
import type { ReactNode } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { formatDayShort } from "../../model/statistics-format";
import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { SeriesSection } from "./series-section";

const { series } = overviewFixture();

const seriesText = messages.statistics.series;

const translateSeries = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.series",
});

const LIFECYCLE_LABELS = Object.values(seriesText.lifecycle);

const MARATHON_LEAD = seriesText.marathon.slice(0, seriesText.marathon.indexOf("{")).trim();

const NO_MARATHON: ReadingStatisticsSeriesSection["marathon"] = {
  availability: "unavailable",
  data: null,
  reason: "INSUFFICIENT_SAMPLE",
};

const ZERO_LIFECYCLE: ReadingStatisticsSeriesSection["lifecycle"] = {
  availability: "available",
  data: { caughtUp: 0, completed: 0, continued: 0, started: 0 },
};

const ZERO_READS: ReadingStatisticsSeriesSection = {
  ...series,
  completedReadsCount: 0,
  lifecycle: ZERO_LIFECYCLE,
  marathon: NO_MARATHON,
  mostActive: [],
  seriesCompletedReadsCount: 0,
  seriesShare: null,
  topProgress: [],
};

const LEGACY_LIFECYCLE: ReadingStatisticsSeriesSection["lifecycle"] = {
  availability: "unavailable",
  data: null,
  reason: "LEGACY_HISTORY_INCOMPLETE",
};

describe("SeriesSection", () => {
  it("shows one empty state and nothing else when the period has no completed reads", () => {
    renderWithProviders(<SeriesSection series={ZERO_READS} />);

    expect(screen.getAllByText(seriesText.noReadsTitle)).toHaveLength(1);
    expect(screen.getByText(seriesText.noReadsDescription)).toBeInTheDocument();
    expect(screen.queryByText("0%", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.shareUnknown)).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.mostActiveTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.topProgressTitle)).not.toBeInTheDocument();
    for (const label of LIFECYCLE_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("reports unavailable series data rather than an empty period", () => {
    renderWithProviders(<SeriesSection series={{ ...ZERO_READS, availability: "unavailable" }} />);

    expect(screen.getByText(seriesText.unavailable)).toBeInTheDocument();
    expect(screen.queryByText(seriesText.noReadsTitle)).not.toBeInTheDocument();
  });

  it("shows a zero share and an empty ranking when no completed read belongs to a series", () => {
    renderWithProviders(
      <SeriesSection
        series={{
          ...series,
          completedReadsCount: 12,
          lifecycle: ZERO_LIFECYCLE,
          marathon: NO_MARATHON,
          mostActive: [],
          seriesCompletedReadsCount: 0,
          seriesShare: 0,
          topProgress: [],
        }}
      />,
    );

    expect(
      screen.getByText(translateSeries("share", { percent: "0", series: 0, total: 12 })),
    ).toBeInTheDocument();
    expect(screen.getByText(seriesText.empty)).toBeInTheDocument();
    expect(screen.queryByText(MARATHON_LEAD, { exact: false })).not.toBeInTheDocument();
  });

  it("explains why lifecycle stages are missing for legacy history", () => {
    renderWithProviders(<SeriesSection series={{ ...series, lifecycle: LEGACY_LIFECYCLE }} />);

    expect(screen.getByText(seriesText.reason.LEGACY_HISTORY_INCOMPLETE)).toBeInTheDocument();
    for (const label of LIFECYCLE_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("keeps the share and the ranking when lifecycle stages are missing", () => {
    renderWithProviders(
      <SeriesSection
        series={{
          ...series,
          completedReadsCount: 20,
          lifecycle: LEGACY_LIFECYCLE,
          seriesCompletedReadsCount: 5,
          seriesShare: 0.25,
        }}
      />,
    );

    expect(
      screen.getByText(translateSeries("share", { percent: "25", series: 5, total: 20 })),
    ).toBeInTheDocument();
    expect(screen.getByText(seriesText.mostActiveTitle)).toBeInTheDocument();
    expect(screen.getByText(seriesText.topProgressTitle)).toBeInTheDocument();
  });

  it("pairs each lifecycle stage with its count", () => {
    renderWithProviders(
      <SeriesSection
        series={{
          ...series,
          lifecycle: {
            availability: "available",
            data: { caughtUp: 1, completed: 2, continued: 3, started: 4 },
          },
        }}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      seriesText.lifecycle.started,
      seriesText.lifecycle.continued,
      seriesText.lifecycle.completed,
      seriesText.lifecycle.caughtUp,
    ]);
    expect(screen.getAllByRole("definition").map((count) => count.textContent)).toEqual([
      "4",
      "3",
      "2",
      "1",
    ]);
  });

  it("warns that lifecycle stages do not add up", () => {
    renderWithProviders(<SeriesSection series={series} />);

    expect(screen.getByText(seriesText.lifecycleNote)).toBeInTheDocument();
  });

  it("titles both rankings with what each one counts", () => {
    renderWithProviders(<SeriesSection series={series} />);

    expect(screen.getByText(seriesText.mostActiveTitle)).toBeInTheDocument();
    expect(screen.getByText(seriesText.mostActiveCaption)).toBeInTheDocument();
    expect(screen.getByText(seriesText.topProgressTitle)).toBeInTheDocument();
    expect(screen.getByText(seriesText.topProgressCaption)).toBeInTheDocument();
  });

  it("labels most-active rows with read-throughs and progress rows with first completions", () => {
    renderWithProviders(<SeriesSection series={series} />);

    for (const entry of series.mostActive) {
      expect(
        screen.getByText(translateSeries("reads", { count: entry.completedReadCycles })),
      ).toBeInTheDocument();
    }
    for (const entry of series.topProgress) {
      expect(
        screen.getByText(
          translateSeries("firstCompletions", { count: entry.distinctFirstCompletions }),
        ),
      ).toBeInTheDocument();
    }
  });

  it("links a most-active series to its page", () => {
    renderWithProviders(<SeriesSection series={series} />);

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      `/series/${statisticsIds.seriesId}`,
    ]);
  });

  it("names the series marathon of the period", () => {
    const marathon = series.marathon.data;
    if (marathon === null) throw new Error("the overview fixture has no marathon");

    renderWithProviders(<SeriesSection series={series} />);

    expect(
      screen.getByText(
        translateSeries("marathon", {
          date: formatDayShort(marathon.endFinishedAt, "uk"),
          length: marathon.length,
          name: marathon.name,
        }),
      ),
    ).toBeInTheDocument();
  });
});

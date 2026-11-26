import type { Nullable, ReadingStatisticsSeriesSection } from "@app/shared";
import type { ReactNode } from "react";

import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

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

const SHOW_MORE_LEAD = messages.statistics.rankings.showMore.split("{")[0]?.trim() ?? "";

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

const SECOND_SERIES_ID = "9d6c2f0e-4b1a-4c3e-8f2d-1a7b5c9e3f60";

const TOP_PROGRESS: ReadingStatisticsSeriesSection["topProgress"] = [
  { distinctFirstCompletions: 4, name: "Earthsea", seriesId: statisticsIds.seriesId },
  { distinctFirstCompletions: 1, name: "Hyperion", seriesId: SECOND_SERIES_ID },
];

const translateHint = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.progressHint",
});

function mostActiveEntry(name: string, completedReadCycles: number) {
  const [entry] = series.mostActive;
  if (entry === undefined) throw new Error("the overview fixture has no most-active series");
  return { ...entry, completedReadCycles, name, seriesId: name };
}

function shareCountText(seriesReads: number, totalReads: number): string {
  return translateSeries.markup("shareCount", {
    num: (chunks: string) => chunks,
    series: seriesReads,
    total: totalReads,
  });
}

async function showTopProgress() {
  await userEvent.click(screen.getByRole("radio", { name: seriesText.rankingModes.topProgress }));
}

function withTextContent(expected: string) {
  return (_content: string, element: Nullable<Element>) => element?.textContent === expected;
}

describe("SeriesSection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows one empty state and nothing else when the period has no completed reads", () => {
    renderWithProviders(<SeriesSection series={ZERO_READS} />);

    expect(screen.getAllByText(seriesText.noReadsTitle)).toHaveLength(1);
    expect(screen.getByText(seriesText.noReadsDescription)).toBeInTheDocument();
    expect(screen.queryByText("0%", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.shareUnknown)).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.empty)).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.mostActiveTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(seriesText.topProgressTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
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

    expect(screen.getByText(withTextContent(shareCountText(0, 12)))).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText(seriesText.empty)).toBeInTheDocument();
    expect(screen.queryByText(MARATHON_LEAD, { exact: false })).not.toBeInTheDocument();
  });

  it("collapses missing lifecycle stages into one line whose hint explains the legacy history", async () => {
    renderWithProviders(<SeriesSection series={{ ...series, lifecycle: LEGACY_LIFECYCLE }} />);

    expect(screen.getByText(seriesText.lifecycleUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole("definition")).not.toBeInTheDocument();
    for (const label of LIFECYCLE_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }

    await userEvent.click(
      screen.getByRole("button", {
        name: translateHint("label", { topic: seriesText.lifecycleUnavailable }),
      }),
    );

    expect(
      await screen.findByText(seriesText.reason.LEGACY_HISTORY_INCOMPLETE),
    ).toBeInTheDocument();
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

    expect(screen.getByText(withTextContent(shareCountText(5, 20)))).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: seriesText.mostActiveTitle })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: seriesText.rankingModes.topProgress }),
    ).toBeInTheDocument();
  });

  it("shows the series share as a count, a percent and a named bar", () => {
    renderWithProviders(
      <SeriesSection
        series={{
          ...series,
          completedReadsCount: 6,
          seriesCompletedReadsCount: 3,
          seriesShare: 0.5,
        }}
      />,
    );

    expect(screen.getByText(withTextContent(shareCountText(3, 6)))).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: translateSeries("shareProgressLabel", { percent: "50" }),
      }),
    ).toBeInTheDocument();
  });

  it("explains an unknown series share without a percent or a bar", () => {
    renderWithProviders(<SeriesSection series={{ ...series, seriesShare: null }} />);

    expect(screen.getByText(seriesText.shareUnknown)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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

  it("keeps overlapping lifecycle counts apart instead of adding them up", () => {
    renderWithProviders(
      <SeriesSection
        series={{
          ...series,
          lifecycle: {
            availability: "available",
            data: { caughtUp: 1, completed: 1, continued: 3, started: 2 },
          },
        }}
      />,
    );

    expect(screen.getAllByRole("definition").map((count) => count.textContent)).toEqual([
      "2",
      "3",
      "1",
      "1",
    ]);
    expect(screen.getByText(seriesText.lifecycleNote)).toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("warns that lifecycle stages do not add up", () => {
    renderWithProviders(<SeriesSection series={series} />);

    expect(screen.getByText(seriesText.lifecycleNote)).toBeInTheDocument();
  });

  it("titles both rankings with what each one counts", async () => {
    renderWithProviders(<SeriesSection series={series} />);

    expect(screen.getByRole("list", { name: seriesText.mostActiveTitle })).toBeInTheDocument();
    expect(screen.getByText(seriesText.mostActiveCaption)).toBeInTheDocument();

    await showTopProgress();

    expect(screen.getByRole("list", { name: seriesText.topProgressTitle })).toBeInTheDocument();
    expect(screen.getByText(seriesText.topProgressCaption)).toBeInTheDocument();
  });

  it("labels most-active rows with read-throughs and progress rows with first completions", async () => {
    renderWithProviders(<SeriesSection series={{ ...series, topProgress: TOP_PROGRESS }} />);

    for (const entry of series.mostActive) {
      expect(
        screen.getByText(translateSeries("reads", { count: entry.completedReadCycles })),
      ).toBeInTheDocument();
    }

    await showTopProgress();

    for (const entry of TOP_PROGRESS) {
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

  it("links every progress row to its series page", async () => {
    renderWithProviders(<SeriesSection series={{ ...series, topProgress: TOP_PROGRESS }} />);

    await showTopProgress();

    const ranking = screen.getByRole("list", { name: seriesText.topProgressTitle });
    expect(
      within(ranking)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([`/series/${statisticsIds.seriesId}`, `/series/${SECOND_SERIES_ID}`]);
  });

  it("switches between the rankings in place without a request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<SeriesSection series={series} />);

    await showTopProgress();

    expect(screen.getByRole("radio", { name: seriesText.rankingModes.topProgress })).toBeChecked();
    expect(screen.getByRole("list", { name: seriesText.topProgressTitle })).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: seriesText.mostActiveTitle }),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("offers the ranking switch with the most active series selected first", () => {
    renderWithProviders(<SeriesSection series={series} />);

    const modes = screen.getByRole("radiogroup", { name: seriesText.rankingModeLabel });
    expect(
      within(modes).getByRole("radio", { name: seriesText.rankingModes.mostActive }),
    ).toBeChecked();
    expect(
      within(modes).getByRole("radio", { name: seriesText.rankingModes.topProgress }),
    ).not.toBeChecked();
  });

  it("keeps the ranking switch and shows an empty progress state when no series gained a first completion", async () => {
    renderWithProviders(<SeriesSection series={{ ...series, topProgress: [] }} />);

    expect(
      screen.getByRole("radiogroup", { name: seriesText.rankingModeLabel }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: seriesText.mostActiveTitle })).toBeInTheDocument();

    await showTopProgress();

    expect(screen.getByText(seriesText.topProgressCaption)).toBeInTheDocument();
    expect(screen.getByText(seriesText.topProgressEmpty)).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: seriesText.topProgressTitle }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the exact read count and a shared first place on every tied most-active row without bars", () => {
    const tied = ["Dune", "Hyperion", "Earthsea"].map((name) => mostActiveEntry(name, 1));
    renderWithProviders(<SeriesSection series={{ ...series, mostActive: tied }} />);

    const ranking = screen.getByRole("list", { name: seriesText.mostActiveTitle });
    const oneRead = translateSeries("reads", { count: 1 });
    expect(within(ranking).getAllByRole("listitem")).toHaveLength(3);
    for (const entry of tied) {
      const row = within(ranking).getByRole("link", { name: new RegExp(entry.name) });
      expect(within(row).getByText(oneRead)).toBeInTheDocument();
      expect(within(row).getByText("1")).toBeInTheDocument();
    }
    expect(within(ranking).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("lists every most-active series the API returns without hiding any behind a toggle", () => {
    const entries = ["Dune", "Hyperion", "Earthsea", "Foundation", "Discworld"].map((name, index) =>
      mostActiveEntry(name, 5 - index),
    );
    renderWithProviders(<SeriesSection series={{ ...series, mostActive: entries }} />);

    const ranking = screen.getByRole("list", { name: seriesText.mostActiveTitle });
    expect(within(ranking).getAllByRole("listitem")).toHaveLength(5);
    expect(within(ranking).getByText("Discworld")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: new RegExp(messages.statistics.rankings.showLess) }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: new RegExp(SHOW_MORE_LEAD) }),
    ).not.toBeInTheDocument();
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

  it("ends the marathon line with a single period after a uk abbreviated month", () => {
    const marathon = series.marathon.data;
    if (marathon === null) throw new Error("the overview fixture has no marathon");

    renderWithProviders(
      <SeriesSection
        series={{
          ...series,
          marathon: {
            availability: "available",
            data: { ...marathon, endFinishedAt: "2026-04-05" },
          },
        }}
      />,
    );

    const marathonLine = screen.getByText((content) => content.startsWith(MARATHON_LEAD));
    const marathonText = (marathonLine.textContent ?? "").replace(/\s+/g, " ").trim();

    expect(marathonText).not.toContain("..");
    expect(marathonText).toMatch(/[^.]\.$/);
  });
});

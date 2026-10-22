import type { ReadingStatisticsBucket, ReadingStatisticsComparison } from "@app/shared";
import type { ComponentProps, ReactNode } from "react";

import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { DynamicsChartVariant } from "./reading-dynamics-chart";

import { overviewFixture } from "../../model/statistics.fixtures";
import { ReadingDynamicsCard } from "./reading-dynamics-card";

const text = messages.statistics;

const overview = overviewFixture();

function monthBucket(month: string, pagesRead: number): ReadingStatisticsBucket {
  return {
    completedReads: 1,
    drilldown: {
      filters: { finishedFrom: `2026-${month}-01`, finishedTo: `2026-${month}-28` },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    },
    end: `2026-${month}-28`,
    pagesRead,
    start: `2026-${month}-01`,
    uniqueBooksCompleted: 1,
  };
}

const translateDynamics = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.dynamics",
});

function peakSentencePattern(): RegExp {
  const rangeSlot = "RANGE_SLOT";
  const sentence = translateDynamics
    .markup("peakReads", { range: rangeSlot, reads: 3, value: (chunks: string) => chunks })
    .replace(/\s+/g, " ")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${sentence.replace(rangeSlot, ".+")}$`);
}

const peak = {
  bucket: { ...monthBucket("02", 20), completedReads: 3 },
  count: "3 завершення",
  sentence: peakSentencePattern(),
};

type DynamicsCardProps = ComponentProps<typeof ReadingDynamicsCard>;

function showPeakCard(variant: DynamicsChartVariant) {
  renderWithProviders(
    <ReadingDynamicsCard
      comparison={null}
      dynamics={{
        ...overview.dynamics,
        buckets: [monthBucket("01", 10), peak.bucket, monthBucket("03", 30)],
        peakCompletedReads: peak.bucket,
        peakPagesRead: null,
      }}
      isComparisonLowerBound={false}
      metric="reads"
      onMetricChange={vi.fn()}
      period={overview.period}
      variant={variant}
    />,
  );
}

const comparisonPeriod: ReadingStatisticsComparison = {
  from: "2025-01-01",
  mode: "same_period_last_year",
  to: "2025-03-31",
};

const comparisonResults = {
  fewerReads: { absoluteDelta: -2, comparisonValue: 9, currentValue: 7, percentDelta: -22.2 },
  morePages: { absoluteDelta: 120, comparisonValue: 300, currentValue: 420, percentDelta: 40 },
} as const satisfies Record<string, NonNullable<DynamicsCardProps["comparisonResult"]>>;

function showComparisonCard({
  comparisonResult,
  isComparisonLowerBound = false,
  metric,
  onMetricChange = vi.fn(),
  variant,
}: Partial<Pick<DynamicsCardProps, "isComparisonLowerBound" | "onMetricChange">> &
  Pick<DynamicsCardProps, "comparisonResult" | "metric" | "variant">) {
  renderWithProviders(
    <ReadingDynamicsCard
      comparison={comparisonPeriod}
      comparisonResult={comparisonResult}
      dynamics={{
        ...overview.dynamics,
        buckets: [monthBucket("01", 10), monthBucket("02", 20), monthBucket("03", 30)],
        comparisonBuckets: [monthBucket("01", 5), monthBucket("02", 15), monthBucket("03", 25)],
      }}
      isComparisonLowerBound={isComparisonLowerBound}
      metric={metric}
      onMetricChange={onMetricChange}
      period={overview.period}
      variant={variant}
    />,
  );
}

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/statistics/reading-activity") {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          activeDays: 1,
          booksCount: 0,
          historyQuality: "exact",
          items: [],
          nextCursor: null,
          pagesRead: 0,
          range: { from: url.searchParams.get("from"), to: url.searchParams.get("to") },
          reliableFrom: "2026-01-01",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  }
  return Promise.reject(new Error(`unexpected fetch ${url.pathname}`));
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingDynamicsCard bucket selection", () => {
  it("walks the buckets with the arrow keys, opens one with Enter and returns focus on close", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingDynamicsCard
        comparison={null}
        dynamics={{
          ...overview.dynamics,
          buckets: [monthBucket("01", 10), monthBucket("02", 20), monthBucket("03", 30)],
        }}
        isComparisonLowerBound={false}
        metric="pages"
        onMetricChange={vi.fn()}
        period={overview.period}
        variant="full"
      />,
    );
    const buckets = screen.getAllByRole("button", { name: /сторінок/ });

    for (let step = 0; step < 4 && document.activeElement !== buckets[0]; step += 1) {
      await user.tab();
    }
    expect(buckets[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(buckets[1]).toHaveFocus();
    expect(buckets[0]).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{Enter}");

    const heading = await screen.findByRole("heading", { name: /^Сторінки: / });
    expect(heading).toHaveFocus();
    expect(buckets[1]).toHaveAttribute("aria-expanded", "true");
    expect(new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost").search).toBe(
      "?from=2026-02-01&to=2026-02-28",
    );

    await user.click(screen.getByRole("button", { name: text.details.bucket.close }));

    expect(screen.queryByRole("heading", { name: /^Сторінки: / })).toBeNull();
    expect(buckets[1]).toHaveFocus();
  });
});

describe("ReadingDynamicsCard peak summary", () => {
  it("reads the compact peak summary as the full sentence above the chart", () => {
    showPeakCard("compact");
    const paragraphs = screen.getAllByRole("paragraph");
    const peakRow = paragraphs.find(
      (paragraph) => within(paragraph).queryByRole("strong") !== null,
    );
    if (peakRow === undefined) throw new Error("compact peak summary is missing");

    expect(peakRow).toHaveTextContent(peak.sentence);
    expect(paragraphs.indexOf(peakRow)).toBeLessThan(
      paragraphs.indexOf(screen.getByText(text.dynamics.openHint)),
    );
  });

  it("puts only the peak count in bold in the compact summary", () => {
    showPeakCard("compact");

    expect(screen.getByRole("strong")).toHaveTextContent(new RegExp(`^${peak.count}$`));
  });

  it("reads the full peak summary chip as the full sentence above the chart", () => {
    showPeakCard("full");
    const paragraphs = screen.getAllByRole("paragraph");
    const peakChip = paragraphs.find(
      (paragraph) => within(paragraph).queryByRole("strong") !== null,
    );
    if (peakChip === undefined) throw new Error("full peak summary is missing");

    expect(peakChip).toHaveTextContent(peak.sentence);
    expect(paragraphs.indexOf(peakChip)).toBeLessThan(
      paragraphs.indexOf(screen.getByText(text.dynamics.openHint)),
    );
  });

  it("puts only the peak count in bold in the full summary chip", () => {
    showPeakCard("full");

    expect(screen.getByRole("strong")).toHaveTextContent(new RegExp(`^${peak.count}$`));
  });
});

describe("ReadingDynamicsCard metric switch", () => {
  it("offers completions and pages as the metrics and marks the current one", () => {
    showPeakCard("full");
    const metrics = screen.getByRole("radiogroup", { name: text.dynamics.metricLabel });

    expect(within(metrics).getByRole("radio", { name: text.dynamics.metrics.reads })).toBeChecked();
    expect(
      within(metrics).getByRole("radio", { name: text.dynamics.metrics.pages }),
    ).not.toBeChecked();
  });

  it("asks for the pages metric when the reader picks it", async () => {
    const user = userEvent.setup();
    const onMetricChange = vi.fn();
    showComparisonCard({ metric: "reads", onMetricChange, variant: "full" });

    await user.click(screen.getByRole("radio", { name: text.dynamics.metrics.pages }));

    expect(onMetricChange).toHaveBeenCalledWith("pages");
  });
});

describe("ReadingDynamicsCard comparison", () => {
  it.each(["compact", "full"] as const)(
    "explains on the %s card that pages cannot be compared with an incomplete previous period",
    (variant) => {
      showComparisonCard({
        comparisonResult: comparisonResults.morePages,
        isComparisonLowerBound: true,
        metric: "pages",
        variant,
      });
      const notice = screen.getByRole("status");

      expect(notice).toHaveTextContent(text.dynamics.comparisonUnavailable.title);
      expect(notice).toHaveTextContent(text.dynamics.comparisonUnavailable.description);
    },
  );

  it("drops the page comparison result when the previous period is incomplete", () => {
    showComparisonCard({
      comparisonResult: comparisonResults.morePages,
      isComparisonLowerBound: true,
      metric: "pages",
      variant: "full",
    });

    expect(screen.queryByText("На 120 сторінок більше")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Поточний період: 420 · Період порівняння: 300"),
    ).not.toBeInTheDocument();
  });

  it("keeps comparing completions when only the page history is incomplete", () => {
    showComparisonCard({
      comparisonResult: comparisonResults.fewerReads,
      isComparisonLowerBound: true,
      metric: "reads",
      variant: "full",
    });

    expect(screen.getByRole("status")).toHaveTextContent("На 2 завершені прочитання менше");
    expect(screen.queryByText(text.dynamics.comparisonUnavailable.title)).not.toBeInTheDocument();
  });

  it("states how many more pages the current period has than the comparison period", () => {
    showComparisonCard({
      comparisonResult: comparisonResults.morePages,
      metric: "pages",
      variant: "full",
    });
    const result = screen.getByRole("status");

    expect(result).toHaveTextContent("На 120 сторінок більше");
    expect(result).toHaveTextContent("Поточний період: 420 · Період порівняння: 300");
  });

  it("states how many fewer completions the current period has than the comparison period", () => {
    showComparisonCard({
      comparisonResult: comparisonResults.fewerReads,
      metric: "reads",
      variant: "full",
    });
    const result = screen.getByRole("status");

    expect(result).toHaveTextContent("На 2 завершені прочитання менше");
    expect(result).toHaveTextContent("Поточний період: 7 · Період порівняння: 9");
  });

  it("leaves the comparison result off the compact card", () => {
    showComparisonCard({
      comparisonResult: comparisonResults.morePages,
      metric: "pages",
      variant: "compact",
    });

    expect(screen.queryByText("На 120 сторінок більше")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

import type { ReadingStatisticsRatingBucket } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { formatDayLong, formatDayShort } from "../../model/statistics-format";
import {
  completedReadFixture,
  overviewFixture,
  statisticsIds,
} from "../../model/statistics.fixtures";
import { CompletedReadCard } from "../completed-read-card";
import { RatingsSection } from "./ratings-section";

const { ratings } = overviewFixture();

const ratingsText = messages.statistics.ratings;

const COVERAGE_NOTE = "Середню оцінку розраховано лише за оціненими читаннями.";

const completedReadText = messages.statistics.details.completedRead;

const OPEN_READ = completedReadText.open.replace("{title}", completedReadFixture().book.title);

const DISTRIBUTION_ROW = /^Оцінка /;

const SCALE_HINT_LABEL = ratingsText.distributionScaleHintLabel;

const SHOW_ALL = /Показати всі(?!ю)/;

function finishedOn(day: string) {
  return completedReadText.finishedAt.replace("{date}", formatDayLong(day, "uk"));
}

function fullScale(counts: ReadonlyMap<number, number>): ReadingStatisticsRatingBucket[] {
  return Array.from({ length: 20 }, (_, step) => {
    const rating = 10 - step * 0.5;
    return { completedReadCount: counts.get(rating) ?? 0, rating };
  });
}

function readOfCycle(readingCycleId: string) {
  return completedReadFixture({
    drilldown: { bookId: statisticsIds.bookId, kind: "reading_cycle", readingCycleId },
    readingCycleId,
  });
}

const FOUR_TOP_RATED_READS = [
  readOfCycle(statisticsIds.cycleId),
  readOfCycle(statisticsIds.secondCycleId),
  readOfCycle("88888888-8888-4888-8888-888888888888"),
  readOfCycle("99999999-9999-4999-8999-999999999999"),
];

const SIX_FINISHED_FOUR_RATED = {
  ...ratings,
  averageRating: 9,
  completedReadsCount: 6,
  coverage: { eligibleCount: 6, knownCount: 4, percent: 4 / 6 },
  distribution: fullScale(
    new Map([
      [8, 1],
      [9, 2],
      [10, 1],
    ]),
  ),
  highRatedReadsCount: 4,
  highRatedShare: 1,
  ratedReadsCount: 4,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RatingsSection", () => {
  it("keeps the canonical ten-point scale", () => {
    renderWithProviders(<RatingsSection ratings={ratings} />);

    expect(screen.getByText("8,6 / 10")).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("explains partial coverage in words and leaves the rated count to its KPI", () => {
    renderWithProviders(<RatingsSection ratings={ratings} />);

    expect(screen.getByText(COVERAGE_NOTE)).toBeInTheDocument();
    expect(screen.getByText("28 із 37")).toBeInTheDocument();
    expect(screen.getAllByText(/28 із 37/)).toHaveLength(1);
    expect(screen.queryByText("28 із 37 читань оцінено")).not.toBeInTheDocument();
    expect(screen.getByText("18 із 28")).toBeInTheDocument();
    expect(screen.getByText("64% оцінених")).toBeInTheDocument();
  });

  it("drops the coverage note once every read of the period is rated", () => {
    renderWithProviders(
      <RatingsSection
        ratings={{
          ...ratings,
          availability: "available",
          coverage: { eligibleCount: 37, knownCount: 37, percent: 1 },
          ratedReadsCount: 37,
        }}
      />,
    );

    expect(screen.getByText("37 із 37")).toBeInTheDocument();
    expect(screen.queryByText(COVERAGE_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders an unavailable section instead of a zero average", () => {
    renderWithProviders(
      <RatingsSection
        ratings={{
          ...ratings,
          availability: "unavailable",
          averageRating: null,
          coverage: { eligibleCount: 12, knownCount: 0, percent: 0 },
          distribution: [],
          highRatedReadsCount: 0,
          highRatedShare: null,
          ratedReadsCount: 0,
          reason: "NO_RATINGS",
          topRated: [],
        }}
      />,
    );

    expect(screen.getByText("Оцінок ще немає")).toBeInTheDocument();
    expect(
      screen.getByText("Жодне завершене читання цього періоду не має оцінки."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0,0 / 10")).not.toBeInTheDocument();
  });

  it("keeps a reread as its own top-rated row rather than collapsing it by book", () => {
    const first = completedReadFixture();
    const reread = completedReadFixture({
      drilldown: {
        bookId: first.book.bookId,
        kind: "reading_cycle",
        readingCycleId: "99999999-9999-4999-8999-999999999999",
      },
      finishedAt: "2026-02-01",
      readingCycleId: "99999999-9999-4999-8999-999999999999",
    });

    renderWithProviders(<RatingsSection ratings={{ ...ratings, topRated: [first, reread] }} />);

    expect(screen.getAllByText("Чарівник Земномор'я")).toHaveLength(2);
  });

  it("dates a top-rated read with its year next to its rating", () => {
    const read = completedReadFixture();

    renderWithProviders(
      <RatingsSection ratings={{ ...ratings, distribution: [], topRated: [read] }} />,
    );

    const card = screen.getByRole("listitem");
    expect(card).toHaveTextContent(formatDayLong(read.finishedAt, "uk"));
    expect(card).toHaveTextContent(/2026/);
    expect(card).toHaveTextContent("9/10");
  });

  it("keeps two reads of one book finished on the same day as two dated rows", () => {
    const first = completedReadFixture();
    const sameDayReread = completedReadFixture({
      drilldown: {
        bookId: first.book.bookId,
        kind: "reading_cycle",
        readingCycleId: statisticsIds.secondCycleId,
      },
      finishedAt: first.finishedAt,
      readingCycleId: statisticsIds.secondCycleId,
    });
    const finishedOn = formatDayLong(first.finishedAt, "uk");

    renderWithProviders(
      <RatingsSection
        ratings={{ ...ratings, distribution: [], topRated: [first, sameDayReread] }}
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(finishedOn);
    expect(rows[1]).toHaveTextContent(finishedOn);
  });

  it("splits the ratings and the top-rated reads into two titled cards", () => {
    renderWithProviders(<RatingsSection ratings={ratings} />);

    expect(screen.getByText(ratingsText.title)).toBeInTheDocument();
    expect(screen.getByText(ratingsText.topRatedTitle)).toBeInTheDocument();
    expect(screen.getByText(ratingsText.topRatedDescription)).toBeInTheDocument();
  });

  it("orders the KPIs as average, rated reads, then high ratings", () => {
    renderWithProviders(<RatingsSection ratings={ratings} />);

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      ratingsText.averageRating,
      ratingsText.ratedReads,
      ratingsText.highRated,
    ]);
  });

  it("counts rated reads among every finished read and high ratings among the rated", () => {
    renderWithProviders(<RatingsSection ratings={SIX_FINISHED_FOUR_RATED} />);

    expect(screen.getByText("9,0 / 10")).toBeInTheDocument();
    expect(screen.getByText("4 із 6")).toBeInTheDocument();
    expect(screen.getByText("66,7% завершених")).toBeInTheDocument();
    expect(screen.getByText("4 із 4")).toBeInTheDocument();
    expect(screen.getByText("100% оцінених")).toBeInTheDocument();
    expect(screen.queryByText("100% завершених")).not.toBeInTheDocument();
  });

  it("plots only the given scores of the full scale by default", () => {
    renderWithProviders(<RatingsSection ratings={SIX_FINISHED_FOUR_RATED} />);

    expect(screen.getAllByRole("img", { name: DISTRIBUTION_ROW })).toHaveLength(3);
  });

  it("offers no show-all link beside the scale toggle and keeps one trigger per top-rated read", () => {
    renderWithProviders(
      <RatingsSection ratings={{ ...SIX_FINISHED_FOUR_RATED, topRated: FOUR_TOP_RATED_READS }} />,
    );

    expect(
      screen.getByRole("button", { name: ratingsText.distributionShowAll }),
    ).toBeInTheDocument();
    expect(screen.queryByText(SHOW_ALL)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: SHOW_ALL })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SCALE_HINT_LABEL })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: OPEN_READ })).toHaveLength(
      FOUR_TOP_RATED_READS.length,
    );
  });

  it("lists all four top-rated reads as their own detail buttons", () => {
    renderWithProviders(
      <RatingsSection ratings={{ ...ratings, distribution: [], topRated: FOUR_TOP_RATED_READS }} />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: OPEN_READ })).toHaveLength(4);
  });

  it("opens each of two same-day reads of one book from its own button", () => {
    const first = readOfCycle(statisticsIds.cycleId);
    const sameDayReread = {
      ...readOfCycle(statisticsIds.secondCycleId),
      finishedAt: first.finishedAt,
    };

    renderWithProviders(
      <RatingsSection ratings={{ ...ratings, topRated: [first, sameDayReread] }} />,
    );

    expect(screen.getAllByRole("button", { name: OPEN_READ })).toHaveLength(2);
  });

  it("opens the details of the clicked read rather than another read of its book", async () => {
    vi.stubGlobal("innerWidth", 1280);
    const user = userEvent.setup();
    const first = readOfCycle(statisticsIds.cycleId);
    const second = { ...readOfCycle(statisticsIds.secondCycleId), finishedAt: "2026-02-01" };
    renderWithProviders(<RatingsSection ratings={{ ...ratings, topRated: [first, second] }} />);

    const secondTrigger = screen.getAllByRole("button", { name: OPEN_READ }).at(1);
    if (secondTrigger === undefined) throw new Error("the second read renders no trigger");
    await user.click(secondTrigger);

    const details = await screen.findByRole("dialog", { name: second.book.title });
    expect(details).toHaveTextContent(finishedOn(second.finishedAt));
    expect(details).not.toHaveTextContent(finishedOn(first.finishedAt));
  });
});

describe("CompletedReadCard without showFinishedAt", () => {
  it("leaves the date off a rated ranking card", () => {
    const read = completedReadFixture();

    renderWithProviders(<CompletedReadCard read={read} />);

    const card = screen.getByRole("button", { name: new RegExp(read.book.title) });
    expect(card).toHaveTextContent("9/10");
    expect(card).not.toHaveTextContent(formatDayShort(read.finishedAt, "uk"));
    expect(card).not.toHaveTextContent(/2026/);
  });

  it("falls back to the short date without a year on an unrated ranking card", () => {
    const read = completedReadFixture({ rating: null });

    renderWithProviders(<CompletedReadCard read={read} />);

    const card = screen.getByRole("button", { name: new RegExp(read.book.title) });
    expect(card).toHaveTextContent(formatDayShort(read.finishedAt, "uk"));
    expect(card).not.toHaveTextContent(/2026/);
  });
});

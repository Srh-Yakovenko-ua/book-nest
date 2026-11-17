import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen } from "@/test-utils";

import { formatDayLong, formatDayShort } from "../../model/statistics-format";
import {
  completedReadFixture,
  overviewFixture,
  statisticsIds,
} from "../../model/statistics.fixtures";
import { CompletedReadCard } from "../completed-read-card";
import { RatingsSection } from "./ratings-section";

const { ratings } = overviewFixture();

const COVERAGE_NOTE = "Середню оцінку розраховано лише за оціненими читаннями.";

const HIGH_RATED_HINT = "серед оцінених читань";

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
    expect(screen.getByText(HIGH_RATED_HINT)).toBeInTheDocument();
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

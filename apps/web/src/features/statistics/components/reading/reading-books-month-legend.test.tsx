import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import type { CalendarMonthSummary } from "../../model/statistics-calendar";

import { ReadingBooksMonthLegend } from "./reading-books-month-legend";

const legend = messages.statistics.calendar.heatmap;

function monthSummary(overrides: Partial<CalendarMonthSummary> = {}): CalendarMonthSummary {
  return {
    activeDays: 1,
    books: { count: 1, isLowerBound: false },
    hasLegacyHistory: false,
    hasUnknownDays: false,
    pagesRead: 20,
    ...overrides,
  };
}

describe("ReadingBooksMonthLegend", () => {
  it("shows both the unknown and the before-account items for a month that has both kinds of day", () => {
    renderWithProviders(
      <ReadingBooksMonthLegend
        hasDaysBeforeAccount
        summary={monthSummary({ hasLegacyHistory: true, hasUnknownDays: true })}
      />,
    );

    expect(screen.getByText(legend.unknownLegend)).toBeInTheDocument();
    expect(screen.getByText(legend.beforeAccountLegend)).toBeInTheDocument();
  });

  it("keeps the before-account item out of a month with unknown days that all follow the account", () => {
    renderWithProviders(
      <ReadingBooksMonthLegend
        hasDaysBeforeAccount={false}
        summary={monthSummary({ hasLegacyHistory: true, hasUnknownDays: true })}
      />,
    );

    expect(screen.getByText(legend.unknownLegend)).toBeInTheDocument();
    expect(screen.queryByText(legend.beforeAccountLegend)).not.toBeInTheDocument();
  });
});

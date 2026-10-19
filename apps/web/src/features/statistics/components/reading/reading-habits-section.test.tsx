import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { formatDayRange } from "../../model/statistics-format";
import { calendarFixture, overviewFixture } from "../../model/statistics.fixtures";
import { ReadingHabitsSection } from "./reading-habits-section";

const { meta } = overviewFixture();

const habits = messages.statistics.habits;
const summary = messages.statistics.calendar.summary;

describe("ReadingHabitsSection", () => {
  it("shows the four habit metrics for the measured period", () => {
    const calendar = calendarFixture();
    const range = formatDayRange({ ...calendar.metricRange, locale: "uk" }) ?? "";
    const description = habits.metricRange.replace("{range}", range).replace(/\s+/g, " ");
    renderWithProviders(<ReadingHabitsSection calendar={calendar} meta={meta} />);

    expect(screen.getByText(habits.title)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByText(summary.activeDays)).toBeInTheDocument();
    expect(screen.getByText("2 дні")).toBeInTheDocument();
    expect(screen.getByText(summary.activeDaysRate)).toBeInTheDocument();
    expect(screen.getByText("41,6%")).toBeInTheDocument();
    expect(screen.getByText(summary.longestStreak)).toBeInTheDocument();
    expect(screen.getByText(summary.mostActiveWeekday)).toBeInTheDocument();
  });

  it("marks the habit counts as a lower bound when the period starts before reliable history", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture()}
        meta={{
          ...meta,
          activityHistory: {
            reliableFrom: "2026-02-01",
            selectedPeriodQuality: "legacy_lower_bound",
          },
        }}
      />,
    );

    expect(screen.getByText("≥ 2 дні")).toBeInTheDocument();
  });

  it("hides the current streak for a closed historical period instead of showing zero", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({
          currentStreak: { availability: "unavailable", data: null, reason: "PERIOD_NOT_CURRENT" },
        })}
        meta={meta}
      />,
    );

    expect(screen.queryByText(new RegExp(summary.currentStreak))).not.toBeInTheDocument();
    expect(screen.getByText(summary.longestStreak)).toBeInTheDocument();
  });

  it("marks a clipped current streak instead of implying it is the whole streak", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({
          currentStreak: {
            availability: "available",
            data: {
              continuesBeforeRange: true,
              continuesBeforeReliableHistory: false,
              days: 7,
              endDate: "2026-03-03",
              startDate: "2026-03-01",
            },
          },
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText("7+ днів")).toBeInTheDocument();
    expect(screen.getByText(summary.continuesBeforeRange)).toBeInTheDocument();
  });

  it("explains an unavailable weekday metric instead of silently dropping it", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({
          mostActiveWeekday: {
            availability: "unavailable",
            data: null,
            reason: "LEGACY_HISTORY_INCOMPLETE",
          },
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText(summary.mostActiveWeekday)).toBeInTheDocument();
    expect(screen.getByText(summary.reason.LEGACY_HISTORY_INCOMPLETE)).toBeInTheDocument();
  });

  it("shows an unavailable state instead of zero-filled habits when the calendar is unavailable", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({
          activeDays: 0,
          availability: "unavailable",
          days: [],
          reason: "NO_ACTIVITY_HISTORY",
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText(habits.unavailable)).toBeInTheDocument();
    expect(
      screen.getByText(messages.statistics.calendar.reason.NO_ACTIVITY_HISTORY),
    ).toBeInTheDocument();
    expect(screen.queryByText(summary.activeDays)).not.toBeInTheDocument();
    expect(screen.queryByText("0 днів")).not.toBeInTheDocument();
  });
});

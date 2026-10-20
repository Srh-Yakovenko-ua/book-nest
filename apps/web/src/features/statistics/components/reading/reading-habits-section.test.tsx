import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, within } from "@/test-utils";

import { formatDayRange } from "../../model/statistics-format";
import { calendarFixture, overviewFixture } from "../../model/statistics.fixtures";
import { ReadingHabitsSection } from "./reading-habits-section";

const { meta } = overviewFixture();

const habits = messages.statistics.habits;
const summary = messages.statistics.calendar.summary;

const weekdays = habits.weekdays;

const WEEKDAY_NAMES = {
  mondayFirst: ["понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота", "неділя"],
  sundayFirst: ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"],
} as const;

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

describe("ReadingHabitsSection weekday activity", () => {
  const { weekdayActivity } = calendarFixture();

  function weekdayList(): HTMLElement {
    return screen.getByRole("list", { name: weekdays.title });
  }

  function weekdayRows(): HTMLElement[] {
    return within(weekdayList()).getAllByRole("listitem");
  }

  function rowWeekdayNames() {
    return weekdayRows().map((row) =>
      WEEKDAY_NAMES.sundayFirst.find((name) => within(row).queryByText(name) !== null),
    );
  }

  function weekdayRow(name: string) {
    return weekdayRows().find((row) => within(row).queryByText(name) !== null);
  }

  it("lists the seven weekdays from Monday when the week starts on Monday", () => {
    renderWithProviders(<ReadingHabitsSection calendar={calendarFixture()} meta={meta} />);

    expect(rowWeekdayNames()).toEqual(WEEKDAY_NAMES.mondayFirst);
  });

  it("lists the seven weekdays from Sunday when the week starts on Sunday", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture()}
        meta={{ ...meta, weekStartDay: "sunday" }}
      />,
    );

    expect(rowWeekdayNames()).toEqual(WEEKDAY_NAMES.sundayFirst);
  });

  it("states the active days and the pages read on each weekday's own row", () => {
    renderWithProviders(<ReadingHabitsSection calendar={calendarFixture()} meta={meta} />);

    expect(weekdayRow("понеділок")).toContainElement(
      within(weekdayList()).getByText("2 дні · 184 сторінки"),
    );
    expect(weekdayRow("вівторок")).toContainElement(
      within(weekdayList()).getByText("1 день · 60 сторінок"),
    );
  });

  it("marks both counts of every weekday as a lower bound and says why when part of the history is missing", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({
          weekdayActivity: { ...weekdayActivity, availability: "partial" },
        })}
        meta={meta}
      />,
    );

    expect(weekdayRow("понеділок")).toContainElement(
      within(weekdayList()).getByText("≥ 2 дні · ≥ 184 сторінки"),
    );
    expect(within(weekdayList()).getAllByText(/^≥ .+ · ≥ .+$/)).toHaveLength(7);
    expect(screen.getByText(weekdays.partialNote)).toBeInTheDocument();
  });

  it("shows exact weekday counts without a lower-bound mark when the whole history is recorded", () => {
    renderWithProviders(<ReadingHabitsSection calendar={calendarFixture()} meta={meta} />);

    expect(weekdayRows()).toHaveLength(7);
    expect(within(weekdayList()).queryByText(/≥/)).not.toBeInTheDocument();
    expect(screen.queryByText(weekdays.partialNote)).not.toBeInTheDocument();
  });

  it("says no day had reading instead of drawing seven empty bars when every weekday is zero", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({
          activeDays: 0,
          mostActiveWeekday: { availability: "available", data: null },
          weekdayActivity: {
            availability: "available",
            items: Array.from({ length: 7 }, (_unused, weekday) => ({
              activeDays: 0,
              pagesRead: 0,
              weekday,
            })),
          },
        })}
        meta={meta}
      />,
    );

    expect(screen.getByText(weekdays.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: weekdays.title })).not.toBeInTheDocument();
    expect(screen.getByText(summary.activeDays)).toBeInTheDocument();
  });

  it("leaves the weekday breakdown out while keeping the habit metrics when weekday activity is unavailable", () => {
    renderWithProviders(
      <ReadingHabitsSection
        calendar={calendarFixture({ weekdayActivity: { availability: "unavailable", items: [] } })}
        meta={meta}
      />,
    );

    expect(screen.queryByRole("heading", { name: weekdays.title })).not.toBeInTheDocument();
    expect(screen.queryByText(weekdays.empty)).not.toBeInTheDocument();
    expect(screen.getByText(summary.activeDays)).toBeInTheDocument();
  });

  it("keeps the weekday rows read-only, with nothing to click inside the list", () => {
    renderWithProviders(<ReadingHabitsSection calendar={calendarFixture()} meta={meta} />);

    const list = weekdayList();

    expect(within(list).queryByRole("button")).not.toBeInTheDocument();
    expect(within(list).queryByRole("link")).not.toBeInTheDocument();
  });

  it("explains that the bars count days while the most active weekday counts pages", () => {
    renderWithProviders(<ReadingHabitsSection calendar={calendarFixture()} meta={meta} />);

    expect(screen.getByText(weekdays.criterion)).toBeInTheDocument();
  });

  it("drops the criterion line when there is no most active weekday to explain", () => {
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

    expect(weekdayRows()).toHaveLength(7);
    expect(screen.queryByText(weekdays.criterion)).not.toBeInTheDocument();
  });
});

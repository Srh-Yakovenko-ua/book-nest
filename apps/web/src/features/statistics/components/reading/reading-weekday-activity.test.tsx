import type {
  Nullable,
  ReadingStatisticsCalendarSection,
  StatisticsWeekdayActivity,
  StatisticsWeekdayActivityItem,
  WeekStartDay,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { calendarFixture } from "../../model/statistics.fixtures";
import { ReadingWeekdayActivity } from "./reading-weekday-activity";

const weekdays = messages.statistics.habits.weekdays;

const WEEKDAY_NAMES = {
  mondayFirst: ["понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота", "неділя"],
  sundayFirst: ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"],
} as const;

const WEEKDAYS_FROM_SUNDAY = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const SPOKEN_TEXT = { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' } as const;

type WeekdayKey = (typeof WEEKDAYS_FROM_SUNDAY)[number];

type WeekdayTotals = Pick<StatisticsWeekdayActivityItem, "activeDays" | "pagesRead">;

function calendarWithWeekdays(
  totals: Partial<Record<WeekdayKey, WeekdayTotals>>,
  availability: StatisticsWeekdayActivity["availability"] = "available",
): ReadingStatisticsCalendarSection {
  return calendarFixture({
    weekdayActivity: {
      availability,
      items: WEEKDAYS_FROM_SUNDAY.map((key, weekday) => ({
        activeDays: 0,
        pagesRead: 0,
        ...totals[key],
        weekday,
      })),
    },
  });
}

function listedWeekdayNames(): Nullable<string>[] {
  return within(weekdayList())
    .getAllByRole("button")
    .map((button) => button.textContent);
}

function panelTexts(text: RegExp | string): HTMLElement[] {
  const listed = within(weekdayList()).queryAllByText(text);
  return screen.queryAllByText(text, SPOKEN_TEXT).filter((element) => !listed.includes(element));
}

function panelWeekdayNames(): string[] {
  return WEEKDAY_NAMES.mondayFirst.filter((name) => panelTexts(name).length > 0);
}

function selectedWeekday(): HTMLElement {
  return within(weekdayList()).getByRole("button", { pressed: true });
}

function showWeekdayActivity({
  calendar = calendarFixture(),
  weekStartDay = "monday",
}: {
  calendar?: ReadingStatisticsCalendarSection;
  weekStartDay?: WeekStartDay;
} = {}) {
  renderWithProviders(<ReadingWeekdayActivity calendar={calendar} weekStartDay={weekStartDay} />);
}

function weekdayButton(name: string): HTMLElement {
  return within(weekdayList()).getByRole("button", { name });
}

function weekdayList(): HTMLElement {
  return screen.getByRole("list", { name: weekdays.title });
}

function weekdayRow(name: string): HTMLElement {
  const row = within(weekdayList())
    .getAllByRole("listitem")
    .find((item) => within(item).queryByRole("button", { name }) !== null);
  if (row === undefined) throw new Error(`no weekday row named ${name}`);
  return row;
}

describe("ReadingWeekdayActivity list", () => {
  it("titles the section and explains what each weekday counts", () => {
    showWeekdayActivity();

    expect(screen.getByText(weekdays.title)).toBeInTheDocument();
    expect(screen.getByText(weekdays.description)).toBeInTheDocument();
  });

  it("lists the seven weekdays from Monday when the week starts on Monday", () => {
    showWeekdayActivity({ weekStartDay: "monday" });

    expect(listedWeekdayNames()).toEqual(WEEKDAY_NAMES.mondayFirst);
  });

  it("lists the seven weekdays from Sunday when the week starts on Sunday", () => {
    showWeekdayActivity({ weekStartDay: "sunday" });

    expect(listedWeekdayNames()).toEqual(WEEKDAY_NAMES.sundayFirst);
  });

  it("keeps the short weekday label in the circle hidden from assistive technology", () => {
    showWeekdayActivity();

    expect(within(weekdayRow("понеділок")).getByText("пн")).toHaveAttribute("aria-hidden", "true");
  });

  it("states the reading days and pages on each weekday's own row with spoken prefixes", () => {
    showWeekdayActivity();
    const monday = weekdayRow("понеділок");
    const tuesday = weekdayRow("вівторок");

    expect(within(monday).getByText("2")).toHaveTextContent(`${weekdays.columns.days} 2`);
    expect(within(monday).getByText("184")).toHaveTextContent(`${weekdays.columns.pages} 184`);
    expect(within(tuesday).getByText("1")).toHaveTextContent(`${weekdays.columns.days} 1`);
    expect(within(tuesday).getByText("60")).toHaveTextContent(`${weekdays.columns.pages} 60`);
  });

  it("groups the thousands of a large page total the Ukrainian way", () => {
    showWeekdayActivity({
      calendar: calendarWithWeekdays({ friday: { activeDays: 3, pagesRead: 1234 } }),
    });

    expect(within(weekdayRow("пʼятниця")).getByText("1 234")).toHaveTextContent(
      `${weekdays.columns.pages} 1 234`,
    );
  });

  it("marks every count as a lower bound when the weekday history is partial", () => {
    showWeekdayActivity({
      calendar: calendarFixture({
        weekdayActivity: { ...calendarFixture().weekdayActivity, availability: "partial" },
      }),
    });

    expect(within(weekdayList()).getAllByText(/^≥ \d+$/)).toHaveLength(14);
    expect(within(weekdayRow("понеділок")).getByText("≥ 2")).toBeInTheDocument();
    expect(within(weekdayRow("понеділок")).getByText("≥ 184")).toBeInTheDocument();
  });

  it("shows plain counts with no lower-bound sign when the weekday history is complete", () => {
    showWeekdayActivity();

    expect(screen.queryByText(/≥/)).not.toBeInTheDocument();
  });

  it("says there was no reading yet instead of a list when every weekday is at zero", () => {
    showWeekdayActivity({ calendar: calendarWithWeekdays({}) });

    expect(screen.getByText(weekdays.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: weekdays.title })).not.toBeInTheDocument();
    expect(screen.queryByText(weekdays.panel.label)).not.toBeInTheDocument();
  });

  it("renders nothing when the weekday activity is unavailable", () => {
    const { container } = renderWithProviders(
      <ReadingWeekdayActivity
        calendar={calendarFixture({ weekdayActivity: { availability: "unavailable", items: [] } })}
        weekStartDay="monday"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ReadingWeekdayActivity selection", () => {
  it("selects the weekday with the most reading days even when another has more pages", () => {
    showWeekdayActivity({
      calendar: calendarWithWeekdays({
        thursday: { activeDays: 2, pagesRead: 400 },
        tuesday: { activeDays: 3, pagesRead: 50 },
      }),
    });

    expect(selectedWeekday()).toHaveAccessibleName("вівторок");
  });

  it("breaks a tie in reading days by the larger page total", () => {
    showWeekdayActivity({
      calendar: calendarWithWeekdays({
        thursday: { activeDays: 2, pagesRead: 300 },
        tuesday: { activeDays: 2, pagesRead: 60 },
      }),
    });

    expect(selectedWeekday()).toHaveAccessibleName("четвер");
  });

  it.each([
    { selected: "середа", weekStartDay: "monday" },
    { selected: "неділя", weekStartDay: "sunday" },
  ] as const)(
    "breaks a full tie by the first weekday shown when the week starts on $weekStartDay",
    ({ selected, weekStartDay }) => {
      showWeekdayActivity({
        calendar: calendarWithWeekdays({
          friday: { activeDays: 2, pagesRead: 100 },
          sunday: { activeDays: 2, pagesRead: 100 },
          wednesday: { activeDays: 2, pagesRead: 100 },
        }),
        weekStartDay,
      });

      expect(selectedWeekday()).toHaveAccessibleName(selected);
    },
  );

  it("moves the selection to the weekday the reader clicks", async () => {
    const user = userEvent.setup();
    showWeekdayActivity();

    await user.click(weekdayButton("вівторок"));

    expect(weekdayButton("вівторок")).toHaveAttribute("aria-pressed", "true");
    expect(weekdayButton("понеділок")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the clicked weekday in the panel", async () => {
    const user = userEvent.setup();
    showWeekdayActivity();

    await user.click(weekdayButton("вівторок"));

    expect(panelWeekdayNames()).toEqual(["вівторок"]);
    expect(
      screen.getByText("За вибраний період читання зафіксовано у 1 вівторок."),
    ).toBeInTheDocument();
  });

  it("lets a weekday with no recorded reading be selected", async () => {
    const user = userEvent.setup();
    showWeekdayActivity({
      calendar: calendarWithWeekdays({ friday: { activeDays: 5, pagesRead: 250 } }),
    });

    await user.click(weekdayButton("понеділок"));

    expect(selectedWeekday()).toHaveAccessibleName("понеділок");
    expect(
      screen.getByText("За вибраний період немає збережених записів читання за понеділки."),
    ).toBeInTheDocument();
  });

  it("keeps the selection when the pointer only hovers another weekday", async () => {
    const user = userEvent.setup();
    showWeekdayActivity();

    await user.hover(weekdayButton("вівторок"));

    expect(selectedWeekday()).toHaveAccessibleName("понеділок");
    expect(panelWeekdayNames()).toEqual(["понеділок"]);
  });
});

describe("ReadingWeekdayDetails", () => {
  it("labels the panel with the selected weekday's full name", () => {
    showWeekdayActivity();

    expect(screen.getByText(weekdays.panel.label)).toBeInTheDocument();
    expect(panelWeekdayNames()).toEqual(["понеділок"]);
  });

  it("shows the selected weekday's reading days and page total on two cards", () => {
    showWeekdayActivity();

    expect(panelTexts(weekdays.panel.days)).toHaveLength(1);
    expect(panelTexts(weekdays.panel.pages)).toHaveLength(1);
    expect(panelTexts(/^\d+$/).map((element) => element.textContent)).toEqual(["2", "184"]);
  });

  it("marks both card values as a lower bound when the weekday history is partial", () => {
    showWeekdayActivity({
      calendar: calendarFixture({
        weekdayActivity: { ...calendarFixture().weekdayActivity, availability: "partial" },
      }),
    });

    expect(panelTexts(/^≥ /).map((element) => element.textContent)).toEqual(["≥ 2", "≥ 184"]);
  });

  it.each([
    { activeDays: 1, sentence: "За вибраний період читання зафіксовано у 1 пʼятницю." },
    { activeDays: 2, sentence: "За вибраний період читання зафіксовано у 2 різні пʼятниці." },
    { activeDays: 5, sentence: "За вибраний період читання зафіксовано у 5 різних пʼятниць." },
  ])("sums up $activeDays reading Fridays in one sentence", ({ activeDays, sentence }) => {
    showWeekdayActivity({
      calendar: calendarWithWeekdays({ friday: { activeDays, pagesRead: 40 } }),
    });

    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it("reads the summary sentence out politely as a live region", () => {
    showWeekdayActivity();

    expect(
      screen.getByText("За вибраний період читання зафіксовано у 2 різні понеділки."),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("adds the period note exactly once", () => {
    showWeekdayActivity();

    expect(screen.getAllByText(weekdays.panel.note)).toHaveLength(1);
  });
});

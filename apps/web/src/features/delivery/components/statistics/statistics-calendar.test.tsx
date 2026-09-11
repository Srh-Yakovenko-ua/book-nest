import type {
  BookOrderStatisticsDaily,
  StatisticsCalendarCoverage,
  StatisticsPeriod,
} from "@app/shared";
import type { ReactNode } from "react";

import { addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { StatisticsCalendar } from "./statistics-calendar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TODAY = "2026-03-08";

const PERIOD: StatisticsPeriod = { from: "2026-03-02", to: "2026-03-08" };

const DAILY: BookOrderStatisticsDaily = [
  {
    booksCount: 4,
    date: "2026-03-03",
    drilldown: { targets: [{ booksCount: 4, destination: "in_transit", ordersCount: 2 }] },
    ordersCount: 2,
    totalsByCurrency: [{ currency: "UAH", total: 6773 }],
  },
  {
    booksCount: 3,
    date: "2026-03-05",
    drilldown: {
      targets: [
        { booksCount: 1, destination: "in_transit", ordersCount: 1 },
        { booksCount: 2, destination: "history_received", ordersCount: 2 },
      ],
    },
    ordersCount: 3,
    totalsByCurrency: [],
  },
];

const DATED_COVERAGE: StatisticsCalendarCoverage = {
  ordersInScope: 5,
  ordersWithOrderDate: 5,
  ordersWithoutOrderDate: 0,
};

const EARLIER_YEAR_DAILY: BookOrderStatisticsDaily = [
  {
    booksCount: 1,
    date: "2025-06-10",
    drilldown: { targets: [] },
    ordersCount: 1,
    totalsByCurrency: [],
  },
];

const TWO_YEAR_PERIOD: StatisticsPeriod = { from: "2025-01-01", to: "2026-03-08" };

const UNREACHABLE_DAY_DAILY: BookOrderStatisticsDaily = [
  {
    booksCount: 1,
    date: "2026-03-04",
    drilldown: { targets: [] },
    ordersCount: 1,
    totalsByCurrency: [],
  },
];

const ONE_ORDER_COVERAGE: StatisticsCalendarCoverage = {
  ordersInScope: 1,
  ordersWithOrderDate: 1,
  ordersWithoutOrderDate: 0,
};

const DATELESS_COVERAGE: StatisticsCalendarCoverage = {
  ordersInScope: 6,
  ordersWithOrderDate: 0,
  ordersWithoutOrderDate: 6,
};

const WINTER_DAILY: BookOrderStatisticsDaily = [
  {
    booksCount: 1,
    date: "2026-01-28",
    drilldown: { targets: [] },
    ordersCount: 1,
    totalsByCurrency: [],
  },
  {
    booksCount: 2,
    date: "2026-02-11",
    drilldown: { targets: [] },
    ordersCount: 1,
    totalsByCurrency: [],
  },
  {
    booksCount: 1,
    date: "2026-03-17",
    drilldown: { targets: [] },
    ordersCount: 1,
    totalsByCurrency: [],
  },
];

const WINTER_COVERAGE: StatisticsCalendarCoverage = {
  ordersInScope: 3,
  ordersWithOrderDate: 3,
  ordersWithoutOrderDate: 0,
};

const CALENDAR_GEOMETRY = { gapPx: 3, pitchPx: 17 } as const;

function canvasCenterPx(weekCount: number): number {
  return (weekCount * CALENDAR_GEOMETRY.pitchPx - CALENDAR_GEOMETRY.gapPx) / 2;
}

function labelCenterPx(label: HTMLElement): number {
  return Number.parseFloat(label.style.left) + Number.parseFloat(label.style.width) / 2;
}

function legendSwatches(): HTMLElement[] {
  const row = screen.getByText("Менше замовлень").parentElement;
  if (row === null) throw new Error("expected the legend row to wrap its swatches");
  return Array.from(row.querySelectorAll<HTMLElement>('span[aria-hidden="true"]'));
}

function monthUnderLabel({ label, scopeFrom }: { label: HTMLElement; scopeFrom: string }): string {
  const gridStart = startOfWeek(parseISO(scopeFrom), { weekStartsOn: 1 });
  const week = Math.floor(labelCenterPx(label) / CALENDAR_GEOMETRY.pitchPx);

  return format(addWeeks(gridStart, week), "yyyy-MM");
}

function renderCalendar({
  coverage = DATED_COVERAGE,
  daily = DAILY,
  isTruncated = false,
  period = PERIOD,
  today = TODAY,
}: {
  coverage?: StatisticsCalendarCoverage;
  daily?: BookOrderStatisticsDaily;
  isTruncated?: boolean;
  period?: StatisticsPeriod;
  today?: string;
} = {}) {
  return renderWithProviders(
    <StatisticsCalendar
      coverage={coverage}
      daily={daily}
      drilldown={{
        currencyFilter: null,
        displayCurrency: "UAH",
        isStale: false,
        orderState: null,
        store: null,
      }}
      isTruncated={isTruncated}
      period={period}
      today={today}
    />,
  );
}

async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement): Promise<void> {
  for (let step = 0; step < 12 && document.activeElement !== target; step += 1) {
    await user.tab();
  }
}

describe("StatisticsCalendar", () => {
  it("keeps its name and says which date it groups by", () => {
    renderCalendar();

    expect(screen.getByText("Календар покупок")).toBeInTheDocument();
    expect(
      screen.getByText("Покупки за датою оформлення замовлення. Темніший день — більше замовлень."),
    ).toBeInTheDocument();
  });

  it("moves the subtitle and the legend to books when the mode changes", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("radio", { name: "Книги" }));

    expect(
      screen.getByText("Покупки за датою оформлення замовлення. Темніший день — більше книг."),
    ).toBeInTheDocument();
    expect(screen.getByText("Менше книг")).toBeInTheDocument();
  });

  it("explains that the shading is relative to the busiest day shown", () => {
    renderCalendar();

    expect(
      screen.getByText(
        "Насиченість показує активність відносно найактивнішого дня показаного періоду.",
      ),
    ).toBeInTheDocument();
  });

  it("names the weekdays down the side", () => {
    renderCalendar();

    expect(screen.getByText("пн")).toBeInTheDocument();
    expect(screen.getByText("нд")).toBeInTheDocument();
  });

  it("leaves a quiet day decorative instead of announcing every empty date", () => {
    renderCalendar();

    expect(screen.queryByRole("img", { name: /2 березня 2026 р./ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /2 березня 2026 р./ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/без замовлень/)).not.toBeInTheDocument();
  });

  it("opens a day that lives in one place straight there, on that exact order date", () => {
    renderCalendar();

    expect(
      screen.getByRole("link", { name: /3 березня 2026 р.: 2 замовлення, 4 книги/ }),
    ).toHaveAttribute("href", "/delivery/in-transit?orderedFrom=2026-03-03&orderedTo=2026-03-03");
  });

  it("offers a choice for a day whose orders ended up in two places", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /5 березня 2026 р./ }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?orderedFrom=2026-03-05&orderedTo=2026-03-05",
    );
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&from=2026-03-05&to=2026-03-05",
    );
  });

  it("hides the destinations a day never reached", async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(screen.getByRole("button", { name: /5 березня 2026 р./ }));

    expect(screen.queryByRole("menuitem", { name: /Скасовані/ })).not.toBeInTheDocument();
  });

  it("stops promising an exact day once the source was cut short", () => {
    renderCalendar({ isTruncated: true });

    expect(screen.queryByRole("link", { name: /3 березня 2026 р./ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3 березня 2026 р./ })).toBeInTheDocument();
  });

  it("says the calendar has nothing to draw when the period lies ahead", () => {
    renderCalendar({ period: { from: "2027-01-01", to: "2027-12-31" } });

    expect(screen.getByText("Немає покупок за вибраний період")).toBeInTheDocument();
    expect(
      screen.getByText("Замовлення з датою оформлення за цей період відсутні."),
    ).toBeInTheDocument();
  });

  it("keeps the grid but names the quiet year", () => {
    renderCalendar({
      coverage: ONE_ORDER_COVERAGE,
      daily: EARLIER_YEAR_DAILY,
      period: TWO_YEAR_PERIOD,
    });

    expect(screen.getByText("У 2026 році покупок немає")).toBeInTheDocument();
    expect(screen.getByText("пн")).toBeInTheDocument();
  });
});

describe("StatisticsCalendar empty states", () => {
  it("names a period that holds no dated purchase and skips the grid entirely", () => {
    renderCalendar({
      coverage: { ordersInScope: 0, ordersWithOrderDate: 0, ordersWithoutOrderDate: 0 },
      daily: [],
      period: { from: "2026-01-01", to: "2026-03-08" },
    });

    expect(screen.getByText("Немає покупок за вибраний період")).toBeInTheDocument();
    expect(screen.queryByText("пн")).not.toBeInTheDocument();
  });

  it("names the scope where nothing carries an order date and counts what it hid", () => {
    renderCalendar({ coverage: DATELESS_COVERAGE, daily: [] });

    expect(screen.getByText("Немає покупок із датою оформлення")).toBeInTheDocument();
    expect(
      screen.getByText("6 замовлень без дати оформлення не показані в календарі."),
    ).toBeInTheDocument();
  });

  it("tells a dateless scope apart from a period that simply had no purchases", () => {
    renderCalendar({ coverage: DATELESS_COVERAGE, daily: [] });

    expect(screen.queryByText("Немає покупок за вибраний період")).not.toBeInTheDocument();
    expect(screen.queryByText("пн")).not.toBeInTheDocument();
  });

  it("stays on the quiet year instead of jumping to one that has purchases", () => {
    renderCalendar({
      coverage: ONE_ORDER_COVERAGE,
      daily: EARLIER_YEAR_DAILY,
      period: TWO_YEAR_PERIOD,
    });

    expect(screen.getByRole("combobox", { name: "Рік" })).toHaveTextContent("2026");
  });
});

describe("StatisticsCalendar coverage note", () => {
  it("takes the undated count from the coverage field rather than from a totals difference", () => {
    renderCalendar({
      coverage: { ordersInScope: 20, ordersWithOrderDate: 5, ordersWithoutOrderDate: 2 },
    });

    expect(
      screen.getByText("2 замовлення без дати оформлення не показані в календарі."),
    ).toBeInTheDocument();
  });

  it("stays quiet when every order in scope carries an order date", () => {
    renderCalendar();

    expect(screen.queryByText(/без дати оформлення/)).not.toBeInTheDocument();
  });
});

describe("StatisticsCalendar year selector", () => {
  it("leaves the year out when the period covers a single year", () => {
    renderCalendar();

    expect(screen.queryByRole("combobox", { name: "Рік" })).not.toBeInTheDocument();
  });

  it("offers the year once the period spans two of them", () => {
    renderCalendar({ period: TWO_YEAR_PERIOD });

    expect(screen.getByRole("combobox", { name: "Рік" })).toBeInTheDocument();
  });
});

describe("StatisticsCalendar geometry", () => {
  it("draws a day at the size the redesign settled on", () => {
    renderCalendar();

    expect(screen.getByRole("link", { name: /3 березня 2026 р./ })).toHaveStyle({
      height: "14px",
      width: "14px",
    });
  });

  it("never asks a cell to scale, so hovering does not shift the grid", async () => {
    const user = userEvent.setup();
    renderCalendar();
    const cell = screen.getByRole("link", { name: /3 березня 2026 р./ });

    await user.hover(cell);

    expect(cell.className).not.toMatch(/scale/);
    expect(cell).toHaveStyle({ height: "14px", width: "14px" });
  });

  it("shows one legend swatch per intensity level, the quiet one included", () => {
    renderCalendar();

    expect(legendSwatches()).toHaveLength(5);
  });

  it("sizes the legend swatches like the days they explain", () => {
    renderCalendar();

    for (const swatch of legendSwatches()) {
      expect(swatch).toHaveStyle({ height: "14px", width: "14px" });
    }
  });

  it("names only every other weekday down the side", () => {
    renderCalendar();

    expect(screen.getByText("ср")).toBeInTheDocument();
    expect(screen.queryByText("вт")).not.toBeInTheDocument();
  });
});

describe("StatisticsCalendar day semantics", () => {
  it("keeps a day whose orders reached nowhere focusable but refuses to act on it", () => {
    renderCalendar({ coverage: ONE_ORDER_COVERAGE, daily: UNREACHABLE_DAY_DAILY });
    const cell = screen.getByRole("button", { name: "4 березня 2026 р.: 1 замовлення, 1 книга" });

    expect(cell).toBeEnabled();
    expect(cell).toHaveAttribute("aria-disabled", "true");
  });

  it("owns up inside the card once the source was cut short", () => {
    renderCalendar({ isTruncated: true });

    expect(screen.getByText("Дані календаря можуть бути неповними")).toBeInTheDocument();
    expect(
      screen.getByText("Частина замовлень не увійшла в розрахунок через обмеження вибірки."),
    ).toBeInTheDocument();
  });

  it("leaves a cut-short day focusable while marking it as leading nowhere", () => {
    renderCalendar({ isTruncated: true });
    const cell = screen.getByRole("button", { name: /3 березня 2026 р./ });

    expect(cell).toBeEnabled();
    expect(cell).toHaveAttribute("aria-disabled", "true");
  });
});

describe("StatisticsCalendar assistive semantics", () => {
  it("names the scrollable grid so it is reachable even when it holds no focusable day", () => {
    renderCalendar();
    const grid = screen.getByRole("region", { name: "Сітка календаря покупок" });

    expect(grid).toHaveAttribute("tabindex", "0");
  });

  it("points a cut-short day at the notice that explains why it leads nowhere", () => {
    renderCalendar({ isTruncated: true });
    const cell = screen.getByRole("button", { name: /3 березня 2026 р./ });
    const noticeId = cell.getAttribute("aria-describedby") ?? "";

    expect(document.getElementById(noticeId)).toHaveTextContent(
      "Дані календаря можуть бути неповними",
    );
    expect(cell.classList.contains("cursor-not-allowed")).toBe(true);
  });

  it("keeps the day that opened its menu visually active", async () => {
    const user = userEvent.setup();
    renderCalendar();
    const cell = screen.getByRole("button", { name: /5 березня 2026 р./ });

    expect(cell.classList.contains("ring-2")).toBe(false);

    await user.click(cell);

    expect(cell.classList.contains("ring-2")).toBe(true);
  });
});

describe("StatisticsCalendar month labels", () => {
  it("still names the month when the period is only a few days long", () => {
    renderCalendar();

    expect(screen.getByText("бер.")).toBeInTheDocument();
  });

  it("centres the month of a few-days period over the whole short canvas", () => {
    renderCalendar();

    expect(labelCenterPx(screen.getByText("бер."))).toBeCloseTo(canvasCenterPx(1));
  });

  it("names a one-month period exactly once and borrows no neighbouring month", () => {
    renderCalendar({
      coverage: WINTER_COVERAGE,
      daily: WINTER_DAILY,
      period: { from: "2026-02-01", to: "2026-02-28" },
    });

    expect(screen.getAllByText("лют.")).toHaveLength(1);
    expect(screen.queryByText("січ.")).not.toBeInTheDocument();
    expect(screen.queryByText("бер.")).not.toBeInTheDocument();
  });

  it("names every month a longer period covers and none that it does not", () => {
    renderCalendar({
      coverage: WINTER_COVERAGE,
      daily: WINTER_DAILY,
      period: { from: "2026-01-01", to: "2026-03-31" },
      today: "2026-04-15",
    });

    expect(screen.getByText("січ.")).toBeInTheDocument();
    expect(screen.getByText("лют.")).toBeInTheDocument();
    expect(screen.getByText("бер.")).toBeInTheDocument();
    expect(screen.queryByText("квіт.")).not.toBeInTheDocument();
  });

  it("keeps each surviving label over its own weeks when the period opens mid-month", () => {
    renderCalendar({
      coverage: WINTER_COVERAGE,
      daily: WINTER_DAILY,
      period: { from: "2026-01-26", to: "2026-03-31" },
      today: "2026-04-15",
    });

    expect(monthUnderLabel({ label: screen.getByText("лют."), scopeFrom: "2026-01-26" })).toBe(
      "2026-02",
    );
    expect(monthUnderLabel({ label: screen.getByText("бер."), scopeFrom: "2026-01-26" })).toBe(
      "2026-03",
    );
  });
});

describe("StatisticsCalendar keyboard", () => {
  it("shows the day details to a reader who arrives by keyboard", async () => {
    const user = userEvent.setup();
    renderCalendar();
    const cell = screen.getByRole("link", { name: /3 березня 2026 р./ });

    await tabTo(user, cell);

    expect(cell).toHaveFocus();
    expect(
      within(await screen.findByRole("tooltip")).getByText("2 замовлення"),
    ).toBeInTheDocument();
  });

  it("closes the day menu on Escape and hands focus back to the cell", async () => {
    const user = userEvent.setup();
    renderCalendar();
    const cell = screen.getByRole("button", { name: /5 березня 2026 р./ });

    await user.click(cell);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menuitem", { name: /У дорозі/ })).not.toBeInTheDocument();
    expect(cell).toHaveFocus();
  });
});

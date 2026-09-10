import type {
  BookOrderStatisticsLifecycleComparison,
  BookOrderStatisticsLifecycleStageCounts,
  Nullable,
  StatisticsPeriod,
} from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";

import { StatisticsLifecycle } from "./statistics-lifecycle";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const FIXTURE = {
  comparison: {
    books: {
      delta: {
        active: 1,
        cancelled: 0,
        partially_received: 0,
        partially_shipped: 0,
        received: 5,
        shipped: -1,
        total: 5,
      },
      previous: {
        active: 8,
        cancelled: 4,
        partially_received: 0,
        partially_shipped: 0,
        received: 16,
        shipped: 7,
        total: 31,
      },
    },
    orders: {
      delta: {
        active: 3,
        cancelled: 0,
        partially_received: 1,
        partially_shipped: 2,
        received: -2,
        shipped: 0,
        total: 4,
      },
      previous: {
        active: 12,
        cancelled: 6,
        partially_received: 0,
        partially_shipped: 0,
        received: 13,
        shipped: 15,
        total: 40,
      },
    },
  } satisfies BookOrderStatisticsLifecycleComparison,
  drilldown: {
    currencyFilter: null,
    displayCurrency: "UAH",
    isStale: false,
    orderState: null,
    store: null,
  } satisfies StatisticsDrilldownContext,
  labels: { comparison: "IV квартал 2025", current: "I квартал 2026" },
  period: { from: "2026-01-01", to: "2026-03-31" } satisfies StatisticsPeriod,
  stages: {
    books: {
      active: 9,
      cancelled: 4,
      partially_received: 0,
      partially_shipped: 0,
      received: 21,
      shipped: 6,
      total: 36,
    },
    empty: {
      active: 0,
      cancelled: 0,
      partially_received: 0,
      partially_shipped: 0,
      received: 0,
      shipped: 0,
      total: 0,
    },
    orders: {
      active: 15,
      cancelled: 6,
      partially_received: 1,
      partially_shipped: 2,
      received: 11,
      shipped: 15,
      total: 44,
    },
    ordersWithCancelled: {
      active: 15,
      cancelled: 6,
      partially_received: 1,
      partially_shipped: 2,
      received: 11,
      shipped: 15,
      total: 50,
    },
    ordersWithoutPartialReceipts: {
      active: 15,
      cancelled: 6,
      partially_received: 0,
      partially_shipped: 2,
      received: 11,
      shipped: 15,
      total: 43,
    },
  } satisfies Record<string, BookOrderStatisticsLifecycleStageCounts>,
} as const;

function barWidthOf(label: string): string {
  const bar = rowOf(label).querySelector<HTMLElement>(".bg-secondary > div");
  return bar === null ? "" : bar.style.width;
}

function renderLifecycle({
  books = FIXTURE.stages.books,
  comparison = null,
  comparisonLabel = FIXTURE.labels.comparison,
  drilldown = FIXTURE.drilldown,
  includeCancelled = false,
  orders = FIXTURE.stages.orders,
}: {
  books?: BookOrderStatisticsLifecycleStageCounts;
  comparison?: Nullable<BookOrderStatisticsLifecycleComparison>;
  comparisonLabel?: Nullable<string>;
  drilldown?: StatisticsDrilldownContext;
  includeCancelled?: boolean;
  orders?: BookOrderStatisticsLifecycleStageCounts;
} = {}) {
  return renderWithProviders(
    <StatisticsLifecycle
      comparisonLabel={comparisonLabel}
      currentLabel={FIXTURE.labels.current}
      drilldown={drilldown}
      includeCancelled={includeCancelled}
      lifecycle={{ books, comparison, orders }}
      period={FIXTURE.period}
    />,
  );
}

function rowOf(label: string): HTMLElement {
  const row = screen
    .getAllByRole("listitem")
    .find((candidate) => candidate.textContent?.includes(label) === true);

  if (row === undefined) {
    throw new Error(`no lifecycle row for "${label}"`);
  }

  return row;
}

async function showBooks(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("radio", { name: "Книги" }));
}

async function tabTo(user: ReturnType<typeof userEvent.setup>, target: HTMLElement): Promise<void> {
  for (let step = 0; step < 12 && document.activeElement !== target; step += 1) {
    await user.tab();
  }
}

describe("StatisticsLifecycle bars", () => {
  it("measures every bar against the whole sample, not against the busiest stage", () => {
    renderLifecycle();

    expect(within(rowOf("Очікують відправлення")).getByText("34,1%")).toBeInTheDocument();
    expect(barWidthOf("Очікують відправлення")).not.toBe("100%");
    expect(Number.parseFloat(barWidthOf("Очікують відправлення"))).toBeCloseTo(34.09, 1);
  });

  it("keeps a smaller stage below the leader instead of scaling it to the leader", () => {
    renderLifecycle();

    expect(within(rowOf("Отримані")).getByText("25%")).toBeInTheDocument();
    expect(Number.parseFloat(barWidthOf("Отримані"))).toBeCloseTo(25, 5);
  });
});

describe("StatisticsLifecycle modes", () => {
  it("names every stage an order can be in", () => {
    renderLifecycle();

    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(rowOf("Частково відправлені")).toBeInTheDocument();
    expect(rowOf("Частково отримані")).toBeInTheDocument();
    expect(rowOf("Скасовані")).toBeInTheDocument();
  });

  it("drops the partial stages the books view cannot reach", async () => {
    const user = userEvent.setup();
    renderLifecycle();

    await showBooks(user);

    expect(screen.getByText("Очікують відправлення")).toBeInTheDocument();
    expect(screen.getByText("Відправлені")).toBeInTheDocument();
    expect(screen.getByText("Отримані")).toBeInTheDocument();
    expect(screen.queryByText("Частково відправлені")).toBe(null);
    expect(screen.queryByText("Частково отримані")).toBe(null);
  });

  it("counts the sample in the unit of the active mode", async () => {
    const user = userEvent.setup();
    renderLifecycle();

    expect(screen.getByText("замовлення у вибірці")).toHaveTextContent("44 замовлення у вибірці");

    await showBooks(user);

    expect(screen.getByText("книг у вибірці")).toHaveTextContent("36 книг у вибірці");
    expect(screen.queryByText("замовлення у вибірці")).toBe(null);
  });

  it("switches the per-row unit with the mode", async () => {
    const user = userEvent.setup();
    renderLifecycle();

    expect(within(rowOf("Отримані")).getByText("зам.")).toBeInTheDocument();

    await showBooks(user);

    expect(within(rowOf("Отримані")).getByText("кн.")).toBeInTheDocument();
    expect(within(rowOf("Отримані")).getByText("21")).toBeInTheDocument();
  });
});

describe("StatisticsLifecycle comparison", () => {
  it("says nothing about a comparison period when none was requested", () => {
    renderLifecycle();

    expect(screen.queryByText(/Порівняно з/)).toBe(null);
  });

  it("leaves the rows without a delta when nothing is compared", () => {
    renderLifecycle();

    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.queryByText("без змін")).toBe(null);
  });

  it("names the period the sample is compared against", () => {
    renderLifecycle({ comparison: FIXTURE.comparison });

    expect(screen.getByText("Порівняно з IV квартал 2025.")).toBeInTheDocument();
  });

  it("withholds the comparison line when the period has no name", () => {
    renderLifecycle({ comparison: FIXTURE.comparison, comparisonLabel: null });

    expect(screen.queryByText(/Порівняно з/)).toBe(null);
    expect(screen.getByRole("button", { name: "+3" })).toBeInTheDocument();
  });

  it("signs a growing stage and a shrinking one", () => {
    renderLifecycle({ comparison: FIXTURE.comparison });

    expect(within(rowOf("Очікують відправлення")).getByRole("button")).toHaveTextContent(/^\+3$/);
    expect(within(rowOf("Отримані")).getByRole("button")).toHaveTextContent(/^-2$/);
  });

  it("reads a stage that did not move as без змін", () => {
    renderLifecycle({ comparison: FIXTURE.comparison });

    expect(within(rowOf("Відправлені")).getByRole("button")).toHaveTextContent("без змін");
  });

  it("keeps direction arrows and percent changes out of the rows", () => {
    renderLifecycle({ comparison: FIXTURE.comparison });

    expect(screen.queryByText(/[↑↓]/)).toBe(null);
    expect(screen.getAllByText(/%$/)).toHaveLength(5);
  });

  it("explains a delta with where it came from and where it stands now", async () => {
    const user = userEvent.setup();
    renderLifecycle({ comparison: FIXTURE.comparison });

    await user.hover(screen.getByRole("button", { name: "+3" }));

    const hint = within(await screen.findByRole("tooltip"));
    expect(hint.getByText("Було 12 замовлень")).toBeInTheDocument();
    expect(hint.getByText("Зараз 15 · зміна +3")).toBeInTheDocument();
  });

  it("opens the same explanation for a keyboard reader", async () => {
    const user = userEvent.setup();
    renderLifecycle({ comparison: FIXTURE.comparison });
    const trigger = screen.getByRole("button", { name: "+3" });

    await tabTo(user, trigger);

    expect(trigger).toHaveFocus();
    expect(
      within(await screen.findByRole("tooltip")).getByText("Було 12 замовлень"),
    ).toBeInTheDocument();
  });
});

describe("StatisticsLifecycle cancelled row", () => {
  it("states that cancelled orders sit outside the sample", () => {
    renderLifecycle({ comparison: FIXTURE.comparison });
    const row = rowOf("Скасовані");

    expect(within(row).getByText("Не враховуються у вибірці")).toBeInTheDocument();
    expect(within(row).queryByText("6")).toBe(null);
    expect(within(row).queryByText(/%$/)).toBe(null);
    expect(within(row).queryByRole("link")).toBe(null);
    expect(within(row).queryByRole("button")).toBe(null);
    expect(row.querySelector(".bg-secondary")).toBeNull();
  });

  it("gives cancelled a measured row once it is inside the sample", () => {
    renderLifecycle({ includeCancelled: true, orders: FIXTURE.stages.ordersWithCancelled });
    const row = rowOf("Скасовані");

    expect(within(row).getByText("6")).toBeInTheDocument();
    expect(within(row).getByText("зам.")).toBeInTheDocument();
    expect(within(row).getByText("12%")).toBeInTheDocument();
    expect(barWidthOf("Скасовані")).toBe("12%");
    expect(screen.queryByText("Не враховуються у вибірці")).toBe(null);
  });

  it("sends the cancelled row to the cancelled history tab", () => {
    renderLifecycle({ includeCancelled: true, orders: FIXTURE.stages.ordersWithCancelled });

    expect(screen.getByRole("link", { name: "Скасовані" })).toHaveAttribute(
      "href",
      "/delivery/history?tab=cancelled&from=2026-01-01&to=2026-03-31&orderState=cancelled",
    );
  });
});

describe("StatisticsLifecycle drill-down", () => {
  it("carries the stage and the ordered period into the in-transit list", () => {
    renderLifecycle();

    expect(screen.getByRole("link", { name: "Очікують відправлення" })).toHaveAttribute(
      "href",
      "/delivery/in-transit?orderedFrom=2026-01-01&orderedTo=2026-03-31&orderState=active",
    );
  });

  it("sends a received stage to the received history tab", () => {
    renderLifecycle();

    expect(screen.getByRole("link", { name: "Отримані" })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&from=2026-01-01&to=2026-03-31&orderState=received",
    );
  });

  it("leaves an empty stage without anything to open", () => {
    renderLifecycle({ orders: FIXTURE.stages.ordersWithoutPartialReceipts });

    expect(within(rowOf("Частково отримані")).queryByRole("link")).toBe(null);
    expect(within(rowOf("Частково відправлені")).getByRole("link")).toBeInTheDocument();
  });

  it("offers no drill-down at all in books mode", async () => {
    const user = userEvent.setup();
    renderLifecycle();

    await showBooks(user);

    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});

describe("StatisticsLifecycle empty period", () => {
  it("says the period holds no orders instead of drawing empty bars", () => {
    renderLifecycle({ comparison: FIXTURE.comparison, orders: FIXTURE.stages.empty });

    expect(screen.getByText("За цей період немає замовлень.")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toEqual([]);
    expect(screen.queryByText(/у вибірці/)).toBe(null);
  });
});

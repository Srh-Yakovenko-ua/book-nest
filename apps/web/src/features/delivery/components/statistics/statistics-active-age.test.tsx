import type { ActiveMoneyAgeResponse } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { StatisticsScopeState } from "../../model/statistics-scope-state";

import { StatisticsActiveAge } from "./statistics-active-age";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    className,
    href,
  }: {
    children: ReactNode;
    className: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const NO_FILTERS: StatisticsDrilldownContext = {
  currencyFilter: null,
  displayCurrency: null,
  isStale: false,
  orderState: null,
  store: null,
};

const RESPONSE: ActiveMoneyAgeResponse = {
  asOf: "2026-08-21T12:00:00.000Z",
  buckets: [
    {
      booksCount: 34,
      key: "31_plus",
      ordersCount: 26,
      shipmentsCount: 17,
      totalsByCurrency: [
        { currency: "UAH", total: 17220 },
        { currency: "EUR", total: 71.4 },
      ],
    },
    {
      booksCount: 18,
      key: "15_30",
      ordersCount: 9,
      shipmentsCount: 10,
      totalsByCurrency: [{ currency: "UAH", total: 5978 }],
    },
    {
      booksCount: 12,
      key: "unknown_date",
      ordersCount: 6,
      shipmentsCount: 4,
      totalsByCurrency: [{ currency: "UAH", total: 2100 }],
    },
  ],
  source: { isTruncated: false, loadedOrdersCount: 41, maxOrders: 5000 },
};

function barOf(name: string): HTMLElement {
  const row = rowOf(name);
  const bar = row.querySelector("span[style]");
  if (!(bar instanceof HTMLElement)) throw new Error("row has no progress bar");
  return bar;
}

function renderCard(
  data: ActiveMoneyAgeResponse | undefined = RESPONSE,
  overrides: Partial<StatisticsScopeState<ActiveMoneyAgeResponse>> = {},
) {
  return renderWithProviders(
    <StatisticsActiveAge drilldown={NO_FILTERS} scope={{ ...scopeOf(data), ...overrides }} />,
  );
}

function rowOf(name: string): HTMLElement {
  const title = screen.getAllByText(name).find((node) => node.closest("a") === null);
  const row = title?.closest("li") ?? null;
  if (row === null) throw new Error("row not found");
  return row;
}

function scopeOf(
  data: ActiveMoneyAgeResponse | undefined,
): StatisticsScopeState<ActiveMoneyAgeResponse> {
  return {
    data,
    hasUsableData: data !== undefined,
    isInitialError: false,
    isInitialLoading: false,
    isRefetchError: false,
    isRefreshing: false,
    retry: vi.fn(),
  };
}

describe("StatisticsActiveAge", () => {
  it("says the block is a snapshot, not a period", () => {
    renderCard();

    expect(screen.getByText(/Станом на/)).toBeInTheDocument();
  });

  it("sizes a bar by its share of every active order, not of the fullest bucket", () => {
    renderCard();

    expect(barOf("15–30 днів").style.width).toBe(`${(9 / 41) * 100}%`);
    expect(barOf("31 день і більше").style.width).toBe(`${(26 / 41) * 100}%`);
    expect(barOf("31 день і більше").style.width).not.toBe("100%");
  });

  it("labels the share without repeating the count already in the metadata", () => {
    renderCard();

    expect(within(rowOf("15–30 днів")).getByText("22% активних замовлень")).toBeInTheDocument();
    expect(within(rowOf("15–30 днів")).queryByText(/зам\./)).not.toBeInTheDocument();
  });

  it("keeps the whole age scale visible even where nothing landed", () => {
    renderCard();

    for (const label of ["0–7 днів", "8–14 днів", "15–30 днів", "31 день і більше"]) {
      expect(rowOf(label)).toBeInTheDocument();
    }
    expect(within(rowOf("0–7 днів")).getByText("0 замовлень · 0 книг")).toBeInTheDocument();
    expect(within(rowOf("0–7 днів")).getByText("0% активних замовлень")).toBeInTheDocument();
  });

  it("leaves an empty bucket static, with nothing to click and no money", () => {
    renderCard();

    const empty = rowOf("0–7 днів");
    expect(within(empty).queryByRole("link")).not.toBeInTheDocument();
    expect(empty).not.toHaveTextContent("UAH");
    expect(barOf("0–7 днів").style.width).toBe("0%");
  });

  it("treats the oldest bucket as an age fact, not as a delay to worry about", () => {
    renderCard();

    const oldest = rowOf("31 день і більше");
    expect(oldest.querySelector('use[href*="alert-triangle"]')).toBeNull();
    expect(oldest.querySelector('[class*="destructive"]')).toBeNull();
    expect(oldest).not.toHaveTextContent(/Прострочено|Потребує уваги/);
  });

  it("counts shipments only when the group actually has some", () => {
    renderCard();

    expect(rowOf("15–30 днів")).toHaveTextContent("9 замовлень · 18 книг · 10 посилок");
    expect(rowOf("0–7 днів")).not.toHaveTextContent("посилок");
  });

  it("shows every currency in the bucket without merging them", () => {
    renderCard();

    expect(screen.getByText("17 220 UAH · 71,4 EUR")).toBeInTheDocument();
  });

  it("sends the reader to the in-transit list on that bucket, oldest first", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "31 день і більше" })).toHaveAttribute(
      "href",
      "/delivery/in-transit?ageBucket=31_plus&sort=oldest_orders",
    );
  });

  it("never narrows a current snapshot with the historical period", () => {
    renderCard();

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/from|to|orderedFrom|orderedTo/);
    }
  });

  it("keeps the filters the page is already on", () => {
    renderWithProviders(
      <StatisticsActiveAge
        drilldown={{
          ...NO_FILTERS,
          currencyFilter: "UAH",
          orderState: "shipped",
          store: "Yakaboo",
        }}
        scope={scopeOf(RESPONSE)}
      />,
    );

    expect(screen.getByRole("link", { name: "15–30 днів" })).toHaveAttribute(
      "href",
      "/delivery/in-transit?ageBucket=15_30&sort=oldest_orders&orderState=shipped&store=Yakaboo&currency=UAH",
    );
  });

  it("separates the undated group from the age scale and never sorts it by a date it lacks", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Без дати оформлення" })).toHaveAttribute(
      "href",
      "/delivery/in-transit?ageBucket=unknown_date",
    );
  });

  it("hides the undated group when every active order has a date", () => {
    renderCard({
      ...RESPONSE,
      buckets: RESPONSE.buckets.filter((entry) => entry.key !== "unknown_date"),
    });

    expect(screen.queryByText("Без дати оформлення")).not.toBeInTheDocument();
  });

  it("warns from its own source when the snapshot was cut short", () => {
    renderCard({
      ...RESPONSE,
      source: { isTruncated: true, loadedOrdersCount: 5000, maxOrders: 5000 },
    });

    expect(screen.getByText("Неповні дані")).toBeInTheDocument();
  });

  it("stays quiet when its own source read everything", () => {
    renderCard();

    expect(screen.queryByText("Неповні дані")).not.toBeInTheDocument();
  });

  it("explains an empty snapshot instead of showing four empty buckets", () => {
    renderCard({
      asOf: RESPONSE.asOf,
      buckets: [],
      source: { isTruncated: false, loadedOrdersCount: 0, maxOrders: 5000 },
    });

    expect(screen.getByText("Немає активних замовлень")).toBeInTheDocument();
    expect(
      screen.getByText("Усі замовлення завершені або не містять неотриманих книг."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0–7 днів")).not.toBeInTheDocument();
  });

  it("reports a failed load instead of passing zeros off as a snapshot", () => {
    const retry = vi.fn();
    renderCard(undefined, { isInitialError: true, retry });

    expect(screen.getByText("Не вдалося завантажити активні замовлення.")).toBeInTheDocument();
    expect(screen.queryByText("0% активних замовлень")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторити" })).toBeInTheDocument();
  });

  it("explains the money and the missing date through focusable hints", () => {
    renderCard();

    expect(screen.getAllByRole("button", { name: "Що означає ця сума" })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Чому час невідомий" })).toBeInTheDocument();
  });
});

import type {
  BookOrderStatisticsFinancialCoverage,
  BookOrderStatisticsTopOrdersByCurrency,
} from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { StatisticsTopOrders } from "./statistics-top-orders";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TOP_ORDERS: BookOrderStatisticsTopOrdersByCurrency = [
  {
    currency: "UAH",
    orders: [
      {
        booksCount: 3,
        currency: "UAH",
        derivedStatus: "received",
        id: "uah-1",
        orderDate: "2026-08-11",
        orderNumber: "ST-20260811-50",
        storeName: "Vivat",
        totalAmount: 3670,
      },
      {
        booksCount: 1,
        currency: "UAH",
        derivedStatus: "shipped",
        id: "uah-2",
        orderDate: null,
        orderNumber: null,
        storeName: "Комора",
        totalAmount: 1250,
      },
    ],
  },
  {
    currency: "EUR",
    orders: [
      {
        booksCount: 2,
        currency: "EUR",
        derivedStatus: "shipped",
        id: "eur-1",
        orderDate: "2026-07-03",
        orderNumber: "ST-20260703-45",
        storeName: "Book Depository",
        totalAmount: 52.9,
      },
    ],
  },
  { currency: "USD", orders: [] },
];

const FULL_COVERAGE: readonly BookOrderStatisticsFinancialCoverage[] = [
  { currency: "UAH", ordersInScope: 2, ordersWithResolvedAmount: 2 },
  { currency: "EUR", ordersInScope: 1, ordersWithResolvedAmount: 1 },
  { currency: "USD", ordersInScope: 0, ordersWithResolvedAmount: 0 },
];

function renderTopOrders(currency: "EUR" | "UAH" | "USD" = "UAH") {
  return renderWithProviders(
    <StatisticsTopOrders
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale: false,
        orderState: null,
        store: null,
      }}
      financialCoverageByCurrency={FULL_COVERAGE}
      scopeKey="last_year||||||false"
      topOrdersByCurrency={TOP_ORDERS}
    />,
  );
}

describe("StatisticsTopOrders", () => {
  it("lists only the orders of the chosen currency", () => {
    renderTopOrders();

    expect(screen.getByText("ST-20260811-50")).toBeInTheDocument();
    expect(screen.queryByText("ST-20260703-45")).not.toBeInTheDocument();
  });

  it("shows the amount in the order's own currency", () => {
    renderTopOrders();

    expect(screen.getByText("3 670 UAH")).toBeInTheDocument();
  });

  it("shows the page currency as context rather than as its own control", () => {
    renderTopOrders("UAH");

    expect(screen.queryByRole("radio", { name: "EUR" })).not.toBeInTheDocument();
    expect(screen.getByText("UAH")).toBeInTheDocument();
  });

  it("names the currency and the period when nothing qualifies", () => {
    renderTopOrders("USD");

    expect(
      screen.getByText("Немає замовлень із відомою підсумковою сумою в USD за вибраний період."),
    ).toBeInTheDocument();
  });

  it("stays silent about coverage when every order has a known total", () => {
    renderTopOrders();

    expect(screen.queryByText(/Рейтинг сформовано/)).not.toBeInTheDocument();
  });

  it("explains how many orders the ranking could see when some totals are unknown", () => {
    renderWithProviders(
      <StatisticsTopOrders
        currency="UAH"
        drilldown={{
          currencyFilter: null,
          displayCurrency: "UAH",
          isStale: false,
          orderState: null,
          store: null,
        }}
        financialCoverageByCurrency={[
          { currency: "UAH", ordersInScope: 5, ordersWithResolvedAmount: 2 },
        ]}
        scopeKey="last_year||||||false"
        topOrdersByCurrency={TOP_ORDERS}
      />,
    );

    expect(
      screen.getByText("Рейтинг сформовано для 2 із 5 замовлень із відомою підсумковою сумою."),
    ).toBeInTheDocument();
  });

  it("opens the matching order by its identity rather than by searching its number", () => {
    renderTopOrders();

    expect(screen.getByRole("link", { name: /ST-20260811-50/ })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&orderId=uah-1",
    );
  });

  it("keeps an order without a number just as reachable as the rest", () => {
    renderTopOrders();

    expect(screen.getByText("Замовлення без номера")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Замовлення без номера/ })).toHaveAttribute(
      "href",
      expect.stringContaining("orderId="),
    );
  });
});

const MANY_ORDERS: BookOrderStatisticsTopOrdersByCurrency = [
  {
    currency: "UAH",
    orders: Array.from({ length: 10 }, (_, index) => ({
      booksCount: 1,
      currency: "UAH" as const,
      derivedStatus: "received" as const,
      id: `uah-${index}`,
      orderDate: "2026-08-11",
      orderNumber: `ORD-${index}`,
      storeName: "Vivat",
      totalAmount: 1000 - index * 50,
    })),
  },
  {
    currency: "EUR",
    orders: Array.from({ length: 6 }, (_, index) => ({
      booksCount: 1,
      currency: "EUR" as const,
      derivedStatus: "received" as const,
      id: `eur-${index}`,
      orderDate: "2026-08-11",
      orderNumber: `EUR-${index}`,
      storeName: "Vivat",
      totalAmount: 100 - index * 5,
    })),
  },
];

const NARROWED_ORDERS: BookOrderStatisticsTopOrdersByCurrency = [
  {
    currency: "UAH",
    orders: (MANY_ORDERS.find((entry) => entry.currency === "UAH")?.orders ?? []).slice(0, 4),
  },
];

const MANY_ORDERS_COVERAGE: readonly BookOrderStatisticsFinancialCoverage[] = [
  { currency: "UAH", ordersInScope: 10, ordersWithResolvedAmount: 10 },
  { currency: "EUR", ordersInScope: 6, ordersWithResolvedAmount: 6 },
];

function manyOrdersCard({
  currency = "UAH" as const,
  orders = MANY_ORDERS,
  scopeKey = "last_year||||||false",
}: {
  currency?: "EUR" | "UAH";
  orders?: BookOrderStatisticsTopOrdersByCurrency;
  scopeKey?: string;
} = {}) {
  return (
    <StatisticsTopOrders
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale: false,
        orderState: null,
        store: null,
      }}
      financialCoverageByCurrency={MANY_ORDERS_COVERAGE}
      scopeKey={scopeKey}
      topOrdersByCurrency={orders}
    />
  );
}

function renderManyOrders() {
  return renderWithProviders(manyOrdersCard());
}

describe("StatisticsTopOrders ranking", () => {
  it("ranks the places with plain numbers and no decoration", () => {
    renderManyOrders();

    expect(screen.queryByTestId("rank-sprig")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("draws the priciest order full width and the others against it", () => {
    renderManyOrders();
    const bars = screen.getAllByTestId("top-order-bar");

    expect(bars.at(0)).toHaveStyle({ width: "100%" });
    expect(bars.at(1)).toHaveStyle({ width: "95%" });
  });

  it("shows the first five orders and how many there are in total", () => {
    renderManyOrders();

    expect(screen.getByText("ORD-4")).toBeInTheDocument();
    expect(screen.queryByText("ORD-5")).not.toBeInTheDocument();
    expect(screen.getByText("1–5 із 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Попередня сторінка" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("announces the visible range as it changes", async () => {
    const user = userEvent.setup();
    renderManyOrders();

    expect(screen.getByText("1–5 із 10")).toHaveAttribute("aria-live", "polite");

    await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));

    expect(screen.getByText("6–10 із 10")).toHaveAttribute("aria-live", "polite");
  });

  it("keeps counting the ranks across pages", async () => {
    const user = userEvent.setup();
    renderManyOrders();

    await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));

    expect(screen.getByRole("link", { name: /ORD-9/ })).toBeInTheDocument();
    expect(screen.getByText("6–10 із 10")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Наступна сторінка" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps the boundary buttons reachable instead of dropping the focus", async () => {
    const user = userEvent.setup();
    renderManyOrders();

    const previous = screen.getByRole("button", { name: "Попередня сторінка" });

    expect(previous).not.toBeDisabled();

    previous.focus();

    expect(previous).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));
    const next = screen.getByRole("button", { name: "Наступна сторінка" });

    expect(next).not.toBeDisabled();
    expect(next).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.getByText("6–10 із 10")).toBeInTheDocument();
  });

  it("returns to the first page when the ranking scope changes", async () => {
    const user = userEvent.setup();
    const view = renderManyOrders();

    await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));
    view.rerender(manyOrdersCard({ scopeKey: "last_month||||||false" }));

    expect(screen.getByText("1–5 із 10")).toBeInTheDocument();
  });

  it("returns to the first page when the display currency changes", async () => {
    const user = userEvent.setup();
    const view = renderManyOrders();

    await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));
    view.rerender(manyOrdersCard({ currency: "EUR" }));

    expect(screen.getByText("1–5 із 6")).toBeInTheDocument();
  });

  it("stays on a page that still exists after the ranking shrinks", async () => {
    const user = userEvent.setup();
    const view = renderManyOrders();

    await user.click(screen.getByRole("button", { name: "Наступна сторінка" }));
    view.rerender(manyOrdersCard({ orders: NARROWED_ORDERS }));

    expect(screen.getByText("ORD-3")).toBeInTheDocument();

    view.rerender(manyOrdersCard());

    expect(screen.getByText("1–5 із 10")).toBeInTheDocument();
  });

  it("leaves the pagination away when everything already fits", () => {
    renderTopOrders();

    expect(screen.queryByRole("button", { name: "Наступна сторінка" })).not.toBeInTheDocument();
  });
});

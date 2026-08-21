import type { BookOrderStatisticsView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsCosts } from "./statistics-costs";

const EMPTY_STAGES = {
  active: 0,
  cancelled: 0,
  partially_received: 0,
  partially_shipped: 0,
  received: 0,
  shipped: 0,
  total: 0,
};

function renderCosts({
  budgetShare = null,
  currency = "UAH" as const,
  data = view(),
}: {
  budgetShare?: null | number;
  currency?: "EUR" | "UAH" | "USD";
  data?: BookOrderStatisticsView;
} = {}) {
  return renderWithProviders(
    <StatisticsCosts
      currencies={["UAH", "EUR"]}
      currency={currency}
      deliveryShareOfBudgetPercent={budgetShare}
      onCurrencyChange={vi.fn()}
      view={data}
    />,
  );
}

function view(overrides: Partial<BookOrderStatisticsView> = {}): BookOrderStatisticsView {
  return {
    bestValueStoreByCurrency: [],
    byStore: [],
    comparison: null,
    costs: [
      {
        currency: "UAH",
        deliveryCostPerBook: 10.26,
        deliveryShareOfSpendPercent: 1.5,
        deliveryTotal: 585,
        discountShareOfRawSubtotalPercent: 1.8,
        discountTotal: 650,
        ordersWithDeliveryCount: 7,
        ordersWithDiscountCount: 4,
      },
    ],
    daily: [],
    landedCost: [
      {
        averageLandedBookCost: 710.87,
        countedBooksCount: 57,
        coveragePercent: 96.5,
        currency: "UAH",
        differenceVsAverageRawBookPrice: -14.19,
        eligibleBooksCount: 55,
      },
    ],
    lifecycle: { books: EMPTY_STAGES, comparison: null, orders: EMPTY_STAGES },
    meta: {
      comparisonPeriod: null,
      currentPeriod: { from: null, to: null },
      isTruncated: false,
      loadedOrdersCount: 0,
      maxOrders: null,
    },
    monthly: [],
    pulse: [],
    records: {
      bestValueStoreByCurrency: [],
      largestOrderByCurrency: [],
      mostActiveStore: { byBooks: null, byOrders: null },
      mostBooksInOrder: null,
      recordMonthByCurrency: [],
      scope: { isPeriodFiltered: false, isTruncated: false, period: { from: null, to: null } },
    },
    snapshot: {
      activeBooksCount: 0,
      activeOrdersCount: 0,
      activeShipmentsCount: 0,
      activeTotalsByCurrency: [],
    },
    summary: {
      activeBooksCount: 0,
      activeShipmentsCount: 0,
      activeTotalsByCurrency: [],
      averageBookPriceByCurrency: [{ average: 725.06, currency: "UAH" }],
      averageBooksPerOrder: null,
      averageOrderAmountByCurrency: [],
      booksCount: 0,
      cancelledOrdersCount: 0,
      cancelledTotalsByCurrency: [],
      ordersCount: 0,
      receivedBooksCount: 0,
      receivedTotalsByCurrency: [],
      shipmentsCount: 0,
      totalsByCurrency: [],
    },
    topOrders: [],
    topOrdersByCurrency: [],
    ...overrides,
  };
}

describe("StatisticsCosts", () => {
  it("breaks the delivery cost down per book and as a share of spending", () => {
    renderCosts();

    expect(screen.getByText("585 UAH")).toBeInTheDocument();
    expect(screen.getByText("10,26 UAH на книгу")).toBeInTheDocument();
    expect(screen.getByText("1,5% витрат")).toBeInTheDocument();
  });

  it("mentions the budget only when one applies to the period", () => {
    const { rerender } = renderCosts();

    expect(screen.queryByText(/бюджету/)).not.toBeInTheDocument();

    rerender(
      <StatisticsCosts
        currencies={["UAH", "EUR"]}
        currency="UAH"
        deliveryShareOfBudgetPercent={1.5}
        onCurrencyChange={vi.fn()}
        view={view()}
      />,
    );

    expect(screen.getByText("1,5% бюджету")).toBeInTheDocument();
  });

  it("counts how many books the landed average actually covers", () => {
    renderCosts();

    expect(screen.getByText("Розраховано для 55 із 57 книг")).toBeInTheDocument();
  });

  it("warns that a partial coverage average does not speak for every book", () => {
    renderCosts();

    expect(
      screen.getByText("Покриття 96,5% — середня вартість не охоплює всі книги."),
    ).toBeInTheDocument();
  });

  it("stays quiet when the landed average covers everything", () => {
    const full = view({
      landedCost: [
        {
          averageLandedBookCost: 710.87,
          countedBooksCount: 57,
          coveragePercent: 100,
          currency: "UAH",
          differenceVsAverageRawBookPrice: -14.19,
          eligibleBooksCount: 57,
        },
      ],
    });

    renderCosts({ data: full });

    expect(screen.queryByText(/Покриття/)).not.toBeInTheDocument();
  });

  it("says the real cost sits below the listed price", () => {
    renderCosts();

    expect(screen.getByText("на 14,19 UAH нижча за ціну")).toBeInTheDocument();
  });

  it("shows a dash for a currency it has no numbers for", () => {
    renderCosts({ currency: "EUR" });

    expect(screen.getAllByText("—").length).toBe(3);
  });
});

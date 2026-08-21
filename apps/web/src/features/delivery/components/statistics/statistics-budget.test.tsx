import type { BookBudgetOverview } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsBudget } from "./statistics-budget";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const CURRENT_MONTH = {
  budget: 25000,
  daysInMonth: 31,
  deliveryShareOfBudgetPercent: 1.5,
  elapsedDays: 21,
  forecast: 26959.67,
  month: "2026-08-01",
  projectedOverage: 1959.67,
  remaining: 6737,
  remainingSigned: 6737,
  spentToDate: 18263,
  usedPercent: 73.05,
  validFromMonth: "2026-08-01",
} satisfies NonNullable<BookBudgetOverview["budgets"][number]["currentMonth"]>;

const CONFIGURED: BookBudgetOverview = {
  budgets: [
    {
      currency: "UAH",
      currentMonth: CURRENT_MONTH,
      scheduled: { monthlyAmount: 9000, validFromMonth: "2026-09-01", validToMonth: null },
    },
  ],
  month: "2026-08-01",
};

function renderBudget(overview: BookBudgetOverview | undefined) {
  return renderWithProviders(
    <StatisticsBudget
      currency="UAH"
      isLoading={false}
      onCurrencyChange={vi.fn()}
      overview={overview}
    />,
  );
}

describe("StatisticsBudget", () => {
  it("invites the reader to set a budget instead of showing an error", () => {
    renderBudget({ budgets: [], month: "2026-08-01" });

    expect(
      screen.getByText("Задайте місячний бюджет, щоб бачити прогрес і прогноз витрат."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Задати бюджет" })).toBeInTheDocument();
  });

  it("shows the spend against the budget", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText("18 263 UAH / 25 000 UAH")).toBeInTheDocument();
    expect(screen.getByText("Залишилось 6 737 UAH")).toBeInTheDocument();
  });

  it("reports how much of the budget is used to assistive tech", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "73");
  });

  it("warns about the projected overspend", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText("Прогноз до кінця місяця: ~26 959,67 UAH")).toBeInTheDocument();
    expect(screen.getByText("Можливе перевищення: ~1 959,67 UAH")).toBeInTheDocument();
  });

  it("announces the budget that takes over next month", () => {
    renderBudget(CONFIGURED);

    expect(screen.getByText(/З вересень 2026 р\.: 9 000 UAH/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
  });

  it("explains that the forecast needs a few days of data", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: { ...CURRENT_MONTH, forecast: null, projectedOverage: null },
          scheduled: null,
        },
      ],
    });

    expect(screen.getByText(/Прогноз зʼявиться після/)).toBeInTheDocument();
  });

  it("says the budget is exceeded rather than showing a negative remainder", () => {
    renderBudget({
      ...CONFIGURED,
      budgets: [
        {
          currency: "UAH",
          currentMonth: {
            ...CURRENT_MONTH,
            remaining: 0,
            remainingSigned: -3000,
            usedPercent: 112,
          },
          scheduled: null,
        },
      ],
    });

    expect(screen.getByText("Перевищено на 3 000 UAH")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});

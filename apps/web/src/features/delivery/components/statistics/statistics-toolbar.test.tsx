import type { BookOrderStatisticsMeta } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { StatisticsToolbar } from "./statistics-toolbar";

const META: BookOrderStatisticsMeta = {
  comparisonPeriod: null,
  currentPeriod: { from: "2026-01-01", to: "2026-08-21" },
  isTruncated: false,
  loadedOrdersCount: 51,
  maxOrders: 5000,
};

function buildParams(
  overrides: Partial<UseStatisticsParamsResult> = {},
): UseStatisticsParamsResult {
  return {
    canCompare: true,
    clearFilters: vi.fn(),
    compareMode: null,
    filterCount: 0,
    hasActiveFilters: false,
    periodRange: { from: "2026-01-01", to: "2026-08-21" },
    queryParams: { includeCancelled: "false" },
    setCompareMode: vi.fn(),
    setCustomRange: vi.fn(),
    setFilters: vi.fn(),
    setIncludeCancelled: vi.fn(),
    setPeriod: vi.fn(),
    setSectionMoney: vi.fn(),
    state: {
      compare: null,
      currency: null,
      from: "",
      includeCancelled: false,
      money: null,
      moneyBudget: null,
      moneyCosts: null,
      moneyDynamics: null,
      moneyRecords: null,
      moneyStores: null,
      moneyTopOrders: null,
      period: "this_year",
      status: null,
      store: "",
      to: "",
    },
    today: "2026-08-21",
    ...overrides,
  };
}

describe("StatisticsToolbar", () => {
  it("spells out the exact period rather than just its name", () => {
    renderWithProviders(<StatisticsToolbar meta={META} params={buildParams()} />);

    expect(screen.getByText(/Період: 1 січня – 21 серпня 2026/)).toBeInTheDocument();
  });

  it("spells out the comparison period too", () => {
    renderWithProviders(
      <StatisticsToolbar
        meta={{
          ...META,
          comparisonPeriod: { from: "2025-01-01", mode: "same_period_last_year", to: "2025-08-21" },
        }}
        params={buildParams({ compareMode: "same_period_last_year" })}
      />,
    );

    expect(screen.getByText(/Порівняння: 1 січня – 21 серпня 2025/)).toBeInTheDocument();
  });

  it("says all time when the period has no lower bound", () => {
    renderWithProviders(
      <StatisticsToolbar
        meta={{ ...META, currentPeriod: { from: null, to: "2026-08-21" } }}
        params={buildParams({ canCompare: false })}
      />,
    );

    expect(screen.getByText("Період: за весь час")).toBeInTheDocument();
  });

  it("turns the comparison on with the mode that suits the period", async () => {
    const setCompareMode = vi.fn();
    renderWithProviders(<StatisticsToolbar meta={META} params={buildParams({ setCompareMode })} />);

    await userEvent.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(setCompareMode).toHaveBeenCalledWith("same_period_last_year");
  });

  it("turns the comparison back off", async () => {
    const setCompareMode = vi.fn();
    renderWithProviders(
      <StatisticsToolbar
        meta={META}
        params={buildParams({ compareMode: "previous_period", setCompareMode })}
      />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(setCompareMode).toHaveBeenCalledWith(null);
  });

  it("blocks the comparison when the period cannot carry one", () => {
    renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams({ canCompare: false })} />,
    );

    expect(screen.getByRole("switch", { name: "Порівняти" })).toBeDisabled();
  });

  it("hides the comparator until the comparison is on", () => {
    renderWithProviders(<StatisticsToolbar meta={META} params={buildParams()} />);

    expect(screen.queryByRole("combobox", { name: "Із чим порівнювати" })).not.toBeInTheDocument();
  });

  it("offers the custom dates only for the custom preset", () => {
    const { rerender } = renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams()} />,
    );

    expect(screen.queryByLabelText("Від")).not.toBeInTheDocument();

    rerender(
      <StatisticsToolbar
        meta={META}
        params={buildParams({
          state: { ...buildParams().state, period: "custom" },
        })}
      />,
    );

    expect(screen.getByLabelText("Від")).toBeInTheDocument();
    expect(screen.getByLabelText("До")).toBeInTheDocument();
  });

  it("toggles cancelled orders into the numbers", async () => {
    const setIncludeCancelled = vi.fn();
    renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams({ setIncludeCancelled })} />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Включити скасовані замовлення" }));

    expect(setIncludeCancelled).toHaveBeenCalledWith(true);
  });

  it("offers a reset only while filters are on", () => {
    const { rerender } = renderWithProviders(
      <StatisticsToolbar meta={META} params={buildParams()} />,
    );

    expect(screen.queryByRole("button", { name: "Скинути фільтри" })).not.toBeInTheDocument();

    rerender(
      <StatisticsToolbar
        meta={META}
        params={buildParams({ filterCount: 1, hasActiveFilters: true })}
      />,
    );

    expect(screen.getByRole("button", { name: "Скинути фільтри" })).toBeInTheDocument();
  });
});

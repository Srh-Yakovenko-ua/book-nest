import type { Nullable, ReadingStatisticsPeriod } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { UseStatisticsParamsResult } from "../../model/use-statistics-params";

import { overviewFixture } from "../../model/statistics.fixtures";
import { StatisticsPeriodControls } from "./statistics-period-controls";

const fetchMock = vi.fn((input: RequestInfo | URL) =>
  String(input).includes("/api/profile/settings")
    ? Promise.resolve(
        new Response(JSON.stringify(defaultUserProfileSettings), {
          headers: { "Content-Type": "application/json" },
        }),
      )
    : Promise.reject(new Error(`unexpected fetch ${String(input)}`)),
);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const overview = overviewFixture();

function makeParams(overrides: Partial<UseStatisticsParamsResult> = {}): UseStatisticsParamsResult {
  return {
    canCompare: true,
    compareMode: null,
    isRequestable: true,
    queryParams: { period: "year", year: 2026 },
    rangeIssue: null,
    setCompareMode: vi.fn(),
    setCustomRange: vi.fn(),
    setPeriod: vi.fn(),
    setYear: vi.fn(),
    state: { compare: null, from: "", period: "year", to: "", year: 2026 },
    today: "2026-03-31",
    ...overrides,
  };
}

function render(
  params: UseStatisticsParamsResult,
  comparison = overview.comparison,
  period: Nullable<ReadingStatisticsPeriod> = overview.period,
) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams="">
      <StatisticsPeriodControls comparison={comparison} params={params} period={period} />
    </NuqsTestingAdapter>,
  );
}

const INVALID_CUSTOM_STATE = {
  compare: null,
  from: "2020-01-01",
  period: "custom",
  to: "2025-12-31",
  year: null,
} as const;

describe("StatisticsPeriodControls", () => {
  it("shows the backend-normalized period range", () => {
    render(makeParams());

    expect(screen.getByText(/Період:/)).toBeInTheDocument();
    expect(screen.getByText(/1 січня\s*–\s*31 березня 2026 р\./)).toBeInTheDocument();
  });

  it("shows the backend-normalized comparison range when comparison is on", () => {
    render(makeParams({ compareMode: "same_period_last_year" }), {
      from: "2025-01-01",
      mode: "same_period_last_year",
      to: "2025-03-31",
    });

    expect(screen.getByText(/Порівнюється з/)).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("disables comparison for all time", () => {
    render(
      makeParams({
        canCompare: false,
        state: { compare: null, from: "", period: "all_time", to: "", year: null },
      }),
    );

    expect(screen.getByRole("switch", { name: "Порівняти" })).toBeDisabled();
  });

  it("turns comparison on with the mode the period defaults to", async () => {
    const setCompareMode = vi.fn();
    render(makeParams({ setCompareMode }));

    await userEvent.click(screen.getByRole("switch", { name: "Порівняти" }));

    expect(setCompareMode).toHaveBeenCalledWith("same_period_last_year");
  });

  it("reports a reversed custom range instead of swapping it", () => {
    render(
      makeParams({
        isRequestable: false,
        rangeIssue: "reversed",
        state: {
          compare: null,
          from: "2026-05-31",
          period: "custom",
          to: "2026-03-01",
          year: null,
        },
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Початок періоду не може бути пізнішим за кінець.",
    );
  });

  it("reports a future custom bound instead of clamping it", () => {
    render(
      makeParams({
        isRequestable: false,
        rangeIssue: "future",
        state: {
          compare: null,
          from: "2026-01-01",
          period: "custom",
          to: "2027-01-01",
          year: null,
        },
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Період не може сягати у майбутнє.");
  });

  it("explains the maximum custom range length", () => {
    render(
      makeParams({ isRequestable: false, rangeIssue: "tooLong", state: INVALID_CUSTOM_STATE }),
      null,
      null,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Власний період може охоплювати щонайбільше 1830 днів — близько п’яти років.",
    );
  });

  it("explains the earliest supported start day", () => {
    render(
      makeParams({ isRequestable: false, rangeIssue: "tooEarly", state: INVALID_CUSTOM_STATE }),
      null,
      null,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Період не може починатися раніше за 1 січня 1900 р.",
    );
  });

  it("shows no period caption while no valid period has been loaded", () => {
    render(
      makeParams({ isRequestable: false, rangeIssue: "tooLong", state: INVALID_CUSTOM_STATE }),
      null,
      null,
    );

    expect(screen.queryByText(/Період:/)).not.toBeInTheDocument();
  });

  it("keeps custom dates inside the supported window", async () => {
    render(makeParams({ state: { ...INVALID_CUSTOM_STATE, from: "", to: "" } }));

    await userEvent.click(screen.getByRole("button", { name: "Кінець періоду" }));

    expect(screen.getByRole("combobox", { name: "Місяць" })).toHaveTextContent("бер.");

    await userEvent.click(screen.getByRole("combobox", { name: "Рік" }));

    expect(screen.getByRole("option", { name: "1900" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "1899" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2026" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "2027" })).not.toBeInTheDocument();
  });

  it("sets the custom start to the day picked in the calendar", async () => {
    const setCustomRange = vi.fn();
    render(
      makeParams({
        setCustomRange,
        state: { ...INVALID_CUSTOM_STATE, from: "2026-03-02", to: "2026-03-20" },
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Початок періоду, 2 березня 2026" }));
    await userEvent.click(
      within(screen.getByRole("grid")).getByRole("button", { name: /10-е березня 2026/ }),
    );

    expect(setCustomRange).toHaveBeenCalledWith({ from: "2026-03-10", to: "2026-03-20" });
  });

  it("sets the custom end to the day picked in the calendar", async () => {
    const setCustomRange = vi.fn();
    render(
      makeParams({
        setCustomRange,
        state: { ...INVALID_CUSTOM_STATE, from: "2026-03-02", to: "2026-03-20" },
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Кінець періоду, 20 березня 2026" }));
    await userEvent.click(
      within(screen.getByRole("grid")).getByRole("button", { name: /25-е березня 2026/ }),
    );

    expect(setCustomRange).toHaveBeenCalledWith({ from: "2026-03-02", to: "2026-03-25" });
  });
});

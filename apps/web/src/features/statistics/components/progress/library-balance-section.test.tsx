import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { LibraryBalanceSection } from "./library-balance-section";

type ForecastReason = NonNullable<ReadingStatisticsLibraryBalanceSection["forecast"]["reason"]>;

const { libraryBalance } = overviewFixture();

const balanceText = messages.statistics.libraryBalance;

const translateBalance = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.libraryBalance",
});

const FORECAST_REASONS = [
  "INSUFFICIENT_SAMPLE",
  "LOW_CONFIDENCE",
  "LEGACY_HISTORY_INCOMPLETE",
] as const satisfies readonly ForecastReason[];

const FLOW_LEAD = balanceText.flow.slice(0, balanceText.flow.indexOf("{")).trim();

const translateHint = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.progressHint",
});

const forecastHintButtonName = translateHint("label", { topic: balanceText.forecastLabel });

describe("LibraryBalanceSection", () => {
  it("captions the current snapshot and shows the unread books out of all owned ones", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{ ...libraryBalance, currentOwnedTotal: 186, currentTbrCount: 87 }}
      />,
    );

    const unreadOfOwned = translateBalance.markup("currentTbrBooks", {
      count: 186,
      num: (chunks: string) => chunks,
      total: "186",
      unread: "87",
    });

    expect(screen.getByText(balanceText.description)).toBeInTheDocument();
    expect(screen.getByText(balanceText.currentTbr)).toBeInTheDocument();
    expect(screen.getAllByRole("definition").map((item) => item.textContent)).toContain(
      unreadOfOwned,
    );
  });

  it("shows the read share once and labels the bar with read and unread book counts", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{
          ...libraryBalance,
          currentOwnedTotal: 200,
          currentTbrCount: 94,
          readRatio: 0.53,
        }}
      />,
    );

    expect(
      screen.getByText(translateBalance("readShareBadge", { percent: "53" })),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/53\s?%/)).toHaveLength(1);
    expect(screen.getByText(translateBalance("legendRead", { count: 106 }))).toBeInTheDocument();
    expect(screen.getByText(translateBalance("legendUnread", { count: 94 }))).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: translateBalance("readRatioProgressLabel", { percent: "53" }),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(balanceText.readRatioHint)).toBeInTheDocument();
  });

  it("writes a fractional read share with the uk decimal comma", () => {
    renderWithProviders(
      <LibraryBalanceSection libraryBalance={{ ...libraryBalance, readRatio: 0.113 }} />,
    );

    expect(
      screen.getByText(translateBalance("readShareBadge", { percent: "11,3" })),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: translateBalance("readRatioProgressLabel", { percent: "11,3" }),
      }),
    ).toBeInTheDocument();
  });

  it("counts the unread books next to the read share", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{ ...libraryBalance, currentTbrCount: 87, readRatio: 0.53 }}
      />,
    );

    expect(screen.getByText(translateBalance("legendUnread", { count: 87 }))).toBeInTheDocument();
  });

  it("explains a missing read share with a dash instead of a zero share", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{
          ...libraryBalance,
          currentOwnedTotal: 0,
          currentTbrCount: 0,
          readRatio: null,
        }}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(balanceText.readRatioEmpty)).toBeInTheDocument();
    expect(screen.queryByText(balanceText.readRatioHint)).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(
      screen.queryByText(translateBalance("readShareBadge", { percent: "0" })),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { hidden: true })).not.toBeInTheDocument();
  });

  it("estimates the months left and the pace, explaining the 12-month basis in a hint", async () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{
          ...libraryBalance,
          forecast: {
            availability: "available",
            data: { monthsRemaining: 21.8, readsPerMonth: 4.5 },
          },
        }}
      />,
    );

    expect(
      screen.getByText(translateBalance("forecastEstimate", { months: "21,8", rate: "4,5" })),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: forecastHintButtonName }));

    expect(await screen.findByText(balanceText.forecastBasis)).toHaveTextContent("12");
  });

  it("shows a forecast of zero months as a value rather than a dash", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{
          ...libraryBalance,
          forecast: { availability: "available", data: { monthsRemaining: 0, readsPerMonth: 4 } },
        }}
      />,
    );

    expect(
      screen.getByText(translateBalance("forecastEstimate", { months: "0", rate: "4" })),
    ).toBeInTheDocument();
    expect(screen.queryByText(balanceText.forecastNoData)).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it.each(FORECAST_REASONS)(
    "shows a compact no-data forecast and keeps the %s reason in a hint without a section note",
    async (reason) => {
      renderWithProviders(
        <LibraryBalanceSection
          libraryBalance={{
            ...libraryBalance,
            forecast: { availability: "unavailable", data: null, reason },
          }}
        />,
      );

      expect(screen.getAllByRole("term").at(-1)).toHaveTextContent(balanceText.forecastLabel);
      expect(screen.getAllByRole("definition").at(-1)).toHaveTextContent(
        balanceText.forecastNoData,
      );
      expect(screen.queryByText(balanceText.forecastReason[reason])).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: forecastHintButtonName }));

      expect(await screen.findByText(balanceText.forecastReason[reason])).toBeInTheDocument();
    },
  );

  it("shows the inflow, outflow and net change when the flow is tracked", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{
          ...libraryBalance,
          flow: { availability: "available", data: { inflow: 5, netChange: 3, outflow: 2 } },
        }}
      />,
    );

    expect(screen.getByText(balanceText.flowLabel)).toBeInTheDocument();
    expect(
      screen.getByText(translateBalance("flow", { inflow: 5, net: 3, outflow: 2 })),
    ).toBeInTheDocument();
  });

  it("renders no flow line when the flow history is not tracked", () => {
    renderWithProviders(
      <LibraryBalanceSection
        libraryBalance={{
          ...libraryBalance,
          flow: { availability: "unavailable", data: null, reason: "HISTORY_NOT_TRACKED" },
        }}
      />,
    );

    expect(screen.queryByText(FLOW_LEAD, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(balanceText.flowLabel)).not.toBeInTheDocument();
  });
});

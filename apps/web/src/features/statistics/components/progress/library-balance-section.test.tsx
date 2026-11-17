import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

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

describe("LibraryBalanceSection", () => {
  it("captions the current snapshot and shows the unread books out of all owned ones", () => {
    renderWithProviders(<LibraryBalanceSection libraryBalance={libraryBalance} />);

    expect(screen.getByText(balanceText.description)).toBeInTheDocument();
    expect(
      screen.getByText(
        translateBalance("currentTbrValue", {
          total: libraryBalance.currentOwnedTotal,
          unread: libraryBalance.currentTbrCount,
        }),
      ),
    ).toBeInTheDocument();
  });

  it("shows the read share among owned books by their current statuses", () => {
    renderWithProviders(
      <LibraryBalanceSection libraryBalance={{ ...libraryBalance, readRatio: 0.53 }} />,
    );

    expect(screen.getByText(balanceText.readRatio)).toBeInTheDocument();
    expect(screen.getByText("53%")).toBeInTheDocument();
    expect(screen.getByText(balanceText.readRatioHint)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { hidden: true })).toBeInTheDocument();
  });

  it("explains a missing read share with a dash instead of a zero share", () => {
    renderWithProviders(
      <LibraryBalanceSection libraryBalance={{ ...libraryBalance, readRatio: null }} />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(balanceText.readRatioEmpty)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { hidden: true })).not.toBeInTheDocument();
  });

  it("estimates the months left from the pace of the last 12 months", () => {
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
      screen.getByText(translateBalance("forecastValue", { months: "21,8" })),
    ).toBeInTheDocument();
    expect(screen.getByText(translateBalance("forecastHint", { rate: "4,5" }))).toHaveTextContent(
      "12",
    );
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
      screen.getByText(translateBalance("forecastValue", { months: "0" })),
    ).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it.each(FORECAST_REASONS)(
    "shows a dash and the %s reason inside the forecast stat without a section note",
    (reason) => {
      renderWithProviders(
        <LibraryBalanceSection
          libraryBalance={{
            ...libraryBalance,
            forecast: { availability: "unavailable", data: null, reason },
          }}
        />,
      );

      expect(screen.getAllByRole("term").at(-1)).toHaveTextContent(balanceText.forecast);
      expect(
        screen
          .getAllByRole("definition")
          .slice(-2)
          .map((definition) => definition.textContent),
      ).toEqual(["—", balanceText.forecastReason[reason]]);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
  });
});

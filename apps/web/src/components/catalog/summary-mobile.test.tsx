import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import type { SummaryCard } from "./summary-cards";

import { SummaryDetails } from "./summary-mobile";

const MONEY_CARD: SummaryCard = {
  caption: "30,5 EUR · 59,99 USD",
  icon: "wallet",
  label: "Вартість замовлень",
  microfact: "Середнє замовлення — 1 179,48 UAH",
  value: "27 128 UAH",
};

describe("SummaryDetails", () => {
  it("keeps the secondary currencies next to the headline amount", () => {
    renderWithProviders(<SummaryDetails cards={[MONEY_CARD]} title="Огляд" />);

    expect(screen.getByText("27 128 UAH")).toBeInTheDocument();
    expect(screen.getByText("30,5 EUR · 59,99 USD")).toBeInTheDocument();
    expect(screen.getByText("Середнє замовлення — 1 179,48 UAH")).toBeInTheDocument();
  });

  it("renders nothing extra when a card carries a single amount", () => {
    renderWithProviders(
      <SummaryDetails cards={[{ ...MONEY_CARD, caption: undefined }]} title="Огляд" />,
    );

    expect(screen.queryByText("30,5 EUR · 59,99 USD")).not.toBeInTheDocument();
  });
});

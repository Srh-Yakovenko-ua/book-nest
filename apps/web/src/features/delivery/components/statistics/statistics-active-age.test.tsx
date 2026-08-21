import type { ActiveMoneyAgeResponse } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { StatisticsActiveAge } from "./statistics-active-age";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const NO_FILTERS = { currency: null, store: null };

const RESPONSE: ActiveMoneyAgeResponse = {
  asOf: "2026-08-21T12:00:00.000Z",
  buckets: [
    {
      booksCount: 16,
      key: "31_plus",
      ordersCount: 12,
      shipmentsCount: 12,
      totalsByCurrency: [
        { currency: "UAH", total: 7315 },
        { currency: "EUR", total: 71.4 },
      ],
    },
    {
      booksCount: 3,
      key: "0_7",
      ordersCount: 2,
      shipmentsCount: 2,
      totalsByCurrency: [{ currency: "UAH", total: 1615 }],
    },
    { booksCount: 0, key: "8_14", ordersCount: 0, shipmentsCount: 0, totalsByCurrency: [] },
  ],
};

function renderCard(data: ActiveMoneyAgeResponse | undefined = RESPONSE) {
  return renderWithProviders(
    <StatisticsActiveAge data={data} drilldown={NO_FILTERS} isLoading={false} />,
  );
}

describe("StatisticsActiveAge", () => {
  it("says the block is a snapshot, not a period", () => {
    renderCard();

    expect(screen.getAllByText("Станом на зараз").length).toBeGreaterThan(0);
  });

  it("orders the buckets youngest first no matter how they arrive", () => {
    renderCard();

    const rows = screen.getAllByRole("link");
    expect(rows[0]).toHaveAccessibleName(/0–7 днів/);
    expect(rows[1]).toHaveAccessibleName(/31\+ днів/);
  });

  it("hides a bucket that holds nothing", () => {
    renderCard();

    expect(screen.queryByText("8–14 днів")).not.toBeInTheDocument();
  });

  it("sends the reader to the in-transit list on that bucket, oldest first", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /31\+ днів/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?ageBucket=31_plus&sort=oldest_orders",
    );
  });

  it("shows every currency in the bucket without merging them", () => {
    renderCard();

    expect(screen.getByText("7 315 UAH · 71,4 EUR")).toBeInTheDocument();
  });

  it("explains an empty snapshot instead of showing nothing", () => {
    renderCard({ asOf: RESPONSE.asOf, buckets: [] });

    expect(screen.getByText("Немає активних замовлень.")).toBeInTheDocument();
  });
});

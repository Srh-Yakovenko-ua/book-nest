import type { BookOrderStatisticsTopOrdersByCurrency } from "@app/shared";
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

function renderTopOrders(currency: "EUR" | "UAH" | "USD" = "UAH", onCurrencyChange = vi.fn()) {
  return renderWithProviders(
    <StatisticsTopOrders
      currencies={["UAH", "EUR", "USD"]}
      currency={currency}
      onCurrencyChange={onCurrencyChange}
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

  it("switches the ranking when another currency is picked", async () => {
    const onCurrencyChange = vi.fn();
    renderTopOrders("UAH", onCurrencyChange);

    await userEvent.click(screen.getByRole("radio", { name: "EUR" }));

    expect(onCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("says a currency is empty rather than showing another one's orders", () => {
    renderTopOrders("USD");

    expect(screen.getByText("У валюті USD немає замовлень.")).toBeInTheDocument();
  });

  it("opens the matching order from the row", () => {
    renderTopOrders();

    expect(screen.getByRole("link", { name: /ST-20260811-50/ })).toHaveAttribute(
      "href",
      "/delivery/history?q=ST-20260811-50",
    );
  });

  it("keeps an order without a number visible but not clickable", () => {
    renderTopOrders();

    expect(screen.getByText("Замовлення без номера")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Замовлення без номера/ })).not.toBeInTheDocument();
  });
});

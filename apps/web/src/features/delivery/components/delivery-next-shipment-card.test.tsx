import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { DeliveryNextShipmentCardModel } from "../model/next-shipment-card";

import { DeliveryNextShipmentCard } from "./delivery-next-shipment-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

function makeModel(
  overrides: Partial<DeliveryNextShipmentCardModel> = {},
): DeliveryNextShipmentCardModel {
  return {
    books: {
      book: {
        authorName: "Дженіва Лі",
        bookHref: "/books/book-a",
        id: "book-a",
        title: "Навіки",
      },
      kind: "single",
    },
    expectedDateText: "20 серп. 2026 р.",
    orderId: "order-1",
    relativeDayText: "Через 2 дні",
    sameDayText: null,
    serviceName: "Нова Пошта",
    shipmentId: "shipment-1",
    storeName: "Book24",
    trackingText: "…6789",
    ...overrides,
  };
}

function renderCard(overrides: null | Partial<DeliveryNextShipmentCardModel> = {}) {
  const onReveal = vi.fn();

  renderWithProviders(
    <DeliveryNextShipmentCard
      isLoading={false}
      model={overrides === null ? null : makeModel(overrides)}
      onReveal={onReveal}
      resetsFilters={false}
    />,
  );

  return { onReveal };
}

describe("DeliveryNextShipmentCard", () => {
  it("leads with when the parcel arrives, then where it comes from", () => {
    renderCard();

    expect(screen.getByText("Через 2 дні")).toBeInTheDocument();
    expect(screen.getByText("20 серп. 2026 р.")).toBeInTheDocument();
    expect(screen.getByText("Book24")).toBeInTheDocument();
    expect(screen.getByText("Нова Пошта")).toBeInTheDocument();
    expect(screen.getByText("…6789")).toBeInTheDocument();
  });

  it("names the single book it carries", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /Навіки/ })).toHaveAttribute("href", "/books/book-a");
    expect(screen.getByText("Дженіва Лі")).toBeInTheDocument();
  });

  it("collapses a multi-book parcel into a count", () => {
    renderCard({
      books: {
        countText: "7 книг",
        covers: [
          { authorName: "Лі", bookHref: "/books/book-a", id: "book-a", title: "Навіки" },
          { authorName: "Лі", bookHref: "/books/book-b", id: "book-b", title: "Фейрі" },
        ],
        kind: "stack",
      },
    });

    expect(screen.getByText("7 книг")).toBeInTheDocument();
    expect(screen.queryByText("Дженіва Лі")).not.toBeInTheDocument();
  });

  it("mentions the other parcels arriving that day", () => {
    renderCard({ sameDayText: "Ще 2 доставки цього дня" });

    expect(screen.getByText("Ще 2 доставки цього дня")).toBeInTheDocument();
  });

  it("asks to open the delivery when the list already shows it", async () => {
    const { onReveal } = renderCard();

    await userEvent.click(screen.getByRole("button", { name: /Відкрити доставку/ }));

    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("warns that filters will be cleared when the delivery is hidden", () => {
    renderWithProviders(
      <DeliveryNextShipmentCard
        isLoading={false}
        model={makeModel()}
        onReveal={vi.fn()}
        resetsFilters
      />,
    );

    expect(screen.getByRole("button", { name: /Показати доставку/ })).toBeInTheDocument();
    expect(screen.getByText("Буде скинуто пошук і активні фільтри")).toBeInTheDocument();
  });

  it("explains the gap when no active delivery carries a date", () => {
    renderCard(null);

    expect(screen.getByText("Дата ще невідома")).toBeInTheDocument();
    expect(
      screen.getByText("Для активних доставок не вказано очікувану дату."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

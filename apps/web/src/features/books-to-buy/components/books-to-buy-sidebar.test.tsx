import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeCurrencyEstimate, makeWishlistSummary } from "../model/books-to-buy.fixtures";
import { BooksToBuySidebar } from "./books-to-buy-sidebar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

type SidebarProps = Parameters<typeof BooksToBuySidebar>[0];

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  const props: SidebarProps = {
    bestOffers: [],
    isLoading: false,
    onShowBestOffers: vi.fn(),
    summary: makeWishlistSummary(),
    ...overrides,
  };
  return renderWithProviders(<BooksToBuySidebar {...props} />);
}

describe("BooksToBuySidebar stats", () => {
  it("counts the books and the tracked stores", () => {
    renderSidebar({ summary: makeWishlistSummary({ booksCount: 7, trackedStoresCount: 3 }) });

    expect(screen.getByText("Книг у списку").closest("div")).toHaveTextContent("7");
    expect(screen.getByText("Магазинів відстежується").closest("div")).toHaveTextContent("3");
  });

  it("hints to add prices instead of showing a zero estimate", () => {
    renderSidebar({ summary: makeWishlistSummary({ booksCount: 2, estimates: [] }) });

    expect(
      screen.getByText(
        "Ціни ще не додані. Додайте посилання на магазин із ціною, щоб побачити оцінку.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/грн/)).not.toBeInTheDocument();
  });

  it("shows the average and best price for a single-currency wishlist", () => {
    renderSidebar({
      summary: makeWishlistSummary({
        booksCount: 2,
        estimates: [makeCurrencyEstimate({ average: 450, best: 380, booksCount: 2 })],
      }),
    });

    expect(screen.getByText("450 грн")).toBeInTheDocument();
    expect(screen.getByText("380 грн")).toBeInTheDocument();
  });

  it("omits the currency caption when every book shares one currency", () => {
    renderSidebar({
      summary: makeWishlistSummary({
        booksCount: 2,
        estimates: [makeCurrencyEstimate({ booksCount: 2 })],
      }),
    });

    expect(screen.queryByText(/з ціною/)).not.toBeInTheDocument();
  });

  it("groups the estimates per currency without summing across them", () => {
    renderSidebar({
      summary: makeWishlistSummary({
        booksCount: 3,
        estimates: [
          makeCurrencyEstimate({ average: 450, best: 380, booksCount: 2, currency: "UAH" }),
          makeCurrencyEstimate({ average: 12, best: 10, booksCount: 1, currency: "USD" }),
        ],
      }),
    });

    expect(screen.getByText("UAH · 2 книги з ціною")).toBeInTheDocument();
    expect(screen.getByText("USD · 1 книга з ціною")).toBeInTheDocument();
    expect(screen.getAllByText("Середня ціна")).toHaveLength(2);
    expect(screen.getByText("450 грн")).toBeInTheDocument();
    expect(screen.getByText("12 $")).toBeInTheDocument();
  });

  it("captions the currency when only some books carry a price", () => {
    renderSidebar({
      summary: makeWishlistSummary({
        booksCount: 5,
        estimates: [makeCurrencyEstimate({ booksCount: 2, currency: "UAH" })],
      }),
    });

    expect(screen.getByText("UAH · 2 книги з ціною")).toBeInTheDocument();
  });
});

describe("BooksToBuySidebar best offers", () => {
  const offer = {
    bookId: "book-1",
    coverUrl: null,
    currency: "UAH",
    price: 380,
    storeName: "Yakaboo",
    title: "Останнє бажання",
  } as const;

  it("links each best offer to its book with the store and the price", () => {
    renderSidebar({ bestOffers: [offer] });

    const link = screen.getByRole("link", { name: /Останнє бажання/ });
    expect(link).toHaveAttribute("href", "/books/book-1");
    expect(link).toHaveTextContent("Yakaboo");
    expect(link).toHaveTextContent("380 грн");
  });

  it("shows at most three best offers", () => {
    renderSidebar({
      bestOffers: Array.from({ length: 5 }, (_, index) => ({
        ...offer,
        bookId: `book-${index}`,
        title: `Книга ${index + 1}`,
      })),
    });

    expect(screen.getAllByRole("link", { name: /Книга/ })).toHaveLength(3);
  });

  it("switches the list to the cheapest sort from the sidebar", async () => {
    const onShowBestOffers = vi.fn();
    renderSidebar({ bestOffers: [offer], onShowBestOffers });

    await userEvent.click(screen.getByRole("button", { name: "Переглянути всі" }));

    expect(onShowBestOffers).toHaveBeenCalledOnce();
  });

  it("promises best offers once prices exist", () => {
    renderSidebar({ bestOffers: [] });

    expect(screen.getByText("Тут з'являться книги з найнижчими цінами.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Переглянути всі" })).not.toBeInTheDocument();
  });
});

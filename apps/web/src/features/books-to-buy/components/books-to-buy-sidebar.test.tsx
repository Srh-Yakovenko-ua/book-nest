import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { BooksToBuySidebar } from "./books-to-buy-sidebar";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchMock = vi.fn();

let unsetOwnershipCount: number;

beforeEach(() => {
  unsetOwnershipCount = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          items: [],
          page: 1,
          pagesCount: 1,
          pageSize: 24,
          totalCount: unsetOwnershipCount,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

type SidebarProps = Parameters<typeof BooksToBuySidebar>[0];

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  const props: SidebarProps = {
    bestOffers: [],
    isLoading: false,
    ...overrides,
  };
  return renderWithProviders(<BooksToBuySidebar {...props} />);
}

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

  it("leaves the list order alone, offering only a way into each book", () => {
    renderSidebar({ bestOffers: [offer] });

    expect(screen.getByRole("link", { name: /Останнє бажання/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Переглянути/ })).not.toBeInTheDocument();
  });

  it("promises best offers once prices exist", () => {
    renderSidebar({ bestOffers: [] });

    expect(screen.getByText("Тут з'являться книги з найнижчими цінами.")).toBeInTheDocument();
  });
});

describe("BooksToBuySidebar attention", () => {
  it("reports how many books carry no ownership status", async () => {
    unsetOwnershipCount = 28;
    renderSidebar();

    expect(await screen.findByText("Статус володіння не вказано")).toBeInTheDocument();
    expect(screen.getByText("28 книг без статусу")).toBeInTheDocument();
  });

  it("stays quiet when every book has a status", async () => {
    renderSidebar();

    expect(await screen.findByText("Усі книги розібрані")).toBeInTheDocument();
    expect(screen.queryByText("Статус володіння не вказано")).not.toBeInTheDocument();
  });

  it("opens the picker from the attention row", async () => {
    unsetOwnershipCount = 3;
    renderSidebar();

    await userEvent.click(await screen.findByText("Статус володіння не вказано"));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Книги без статусу володіння");
  });
});

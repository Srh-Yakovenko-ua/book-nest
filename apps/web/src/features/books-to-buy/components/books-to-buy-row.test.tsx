import "@testing-library/jest-dom/vitest";

import type { BookStoreLinkView, WishlistBookView } from "@app/shared";
import type { ReactNode } from "react";

import { defaultUserProfileSettings, MAX_STORE_LINKS_PER_BOOK } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeStoreLink, makeWishlistBook } from "../model/books-to-buy.fixtures";
import { BooksToBuyRow } from "./books-to-buy-row";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const book = makeWishlistBook({ title: "Останнє бажання" });
const fetchMock = vi.fn();

const MENU_LABEL = "Дії для «Останнє бажання»";

function bookWith(storeLinks: BookStoreLinkView[], bestOffer: WishlistBookView["bestOffer"]) {
  return makeWishlistBook({ bestOffer, storeLinks, title: "Останнє бажання" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function pricedLinks() {
  return [
    makeStoreLink({ id: "yakaboo", price: 512, storeName: "Yakaboo", url: "https://yakaboo.ua/a" }),
    makeStoreLink({
      id: "readeat",
      price: 449,
      storeName: "Readeat",
      url: "https://readeat.com/a",
    }),
    makeStoreLink({
      id: "ye",
      price: 470,
      storeName: "Книгарня Є",
      url: "https://book-ye.com.ua/a",
    }),
    makeStoreLink({
      id: "nf",
      price: 528,
      storeName: "Наш Формат",
      url: "https://nashformat.ua/a",
    }),
  ];
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/books/purchase-stores")) return Promise.resolve(jsonResponse([]));
    if (url.endsWith(`/api/books/${book.id}`))
      return Promise.resolve(jsonResponse({ ...book, isFavorite: false }));
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes("/store-links"))
      return Promise.resolve(jsonResponse({ bestOffer: null, storeLinks: [] }));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BooksToBuyRow", () => {
  it("links the book title to its details page", () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    const titleLink = screen.getByRole("link", { name: /Останнє бажання/ });
    expect(titleLink).toHaveAttribute("href", `/books/${book.id}`);
    expect(titleLink.closest("[data-slot=book-card]")).toBeInTheDocument();
    expect(screen.getByText("Клуб Сімейного Дозвілля")).toBeInTheDocument();
    expect(screen.queryByText("Прочитано")).not.toBeInTheDocument();
  });

  it("shows the favorite toggle next to a single actions menu", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Прибрати з улюблених", MENU_LABEL]);

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));

    const statusItem = await screen.findByRole("menuitem", { name: "Оновити статус" });
    expect(statusItem.querySelector("svg")).toBeInTheDocument();
  });

  it("toggles a wishlist book favorite optimistically", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    const favoriteButton = screen.getByRole("button", { name: "Прибрати з улюблених" });
    expect(favoriteButton).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(favoriteButton);

    expect(await screen.findByRole("button", { name: "Додати до улюблених" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("asks what happened to the book from the actions menu", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Оновити статус" }));

    expect(
      await screen.findByRole("heading", { name: "Що сталося з книгою?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Куплено" })).toBeChecked();
  });

  it("opens the store-link form from the actions menu while the book is under the link limit", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Додати посилання" }));

    expect(
      await screen.findByRole("heading", { name: "Додати посилання на магазин" }),
    ).toBeInTheDocument();
  });

  it("opens the store list from the actions menu", async () => {
    renderWithProviders(
      <BooksToBuyRow book={bookWith(pricedLinks(), { currency: "UAH", price: 449 })} />,
    );

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Магазини та ціни (4)" }));

    expect(await screen.findByRole("heading", { name: "Магазини та ціни" })).toBeInTheDocument();
  });

  it("shows the offered store as a chip and counts the remaining ones", () => {
    renderWithProviders(
      <BooksToBuyRow book={bookWith(pricedLinks(), { currency: "UAH", price: 449 })} />,
    );

    const chip = screen.getByRole("link", { name: /Readeat/ });
    expect(chip).toHaveAttribute("href", "https://readeat.com/a");
    expect(chip).toHaveTextContent("449 грн");
    expect(screen.getByText("Найкраща ціна")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ще 3 магазини" })).toBeInTheDocument();
  });

  it("drops the counter when the book tracks a single store", () => {
    renderWithProviders(
      <BooksToBuyRow
        book={bookWith([makeStoreLink({ id: "readeat", price: 449, storeName: "Readeat" })], {
          currency: "UAH",
          price: 449,
        })}
      />,
    );

    expect(screen.getByRole("link", { name: /Readeat/ })).toBeInTheDocument();
    expect(screen.queryByText("Найкраща ціна")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ще/ })).not.toBeInTheDocument();
  });

  it("says that the tracked stores quote no price at all", () => {
    renderWithProviders(
      <BooksToBuyRow
        book={bookWith(
          [
            makeStoreLink({ currency: null, id: "a", price: null, storeName: "Yakaboo" }),
            makeStoreLink({ currency: null, id: "b", price: null, storeName: "Readeat" }),
          ],
          null,
        )}
      />,
    );

    expect(screen.getByRole("button", { name: "2 магазини ціни не вказані" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Yakaboo/ })).not.toBeInTheDocument();
  });

  it("warns that the remaining stores quote another currency", () => {
    renderWithProviders(
      <BooksToBuyRow
        book={bookWith(
          [
            makeStoreLink({ currency: "UAH", id: "ksd", price: 390, storeName: "КСД" }),
            makeStoreLink({ currency: "EUR", id: "bw", price: 12.5, storeName: "Blackwell's" }),
          ],
          { currency: "UAH", price: 390 },
        )}
      />,
    );

    expect(screen.getByRole("button", { name: "ще 1 магазин інші валюти" })).toBeInTheDocument();
  });

  it("keeps the row free of per-link menus", () => {
    renderWithProviders(
      <BooksToBuyRow book={bookWith(pricedLinks(), { currency: "UAH", price: 449 })} />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Редагувати посилання/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Видалити посилання/ })).not.toBeInTheDocument();
  });

  it("keeps the store list reachable once the book reached the store-link limit", async () => {
    const crowded = makeWishlistBook({
      storeLinks: Array.from({ length: MAX_STORE_LINKS_PER_BOOK }, (_, index) =>
        makeStoreLink({ id: `link-${index}`, url: `https://store-${index}.example.com/book` }),
      ),
      title: "Останнє бажання",
    });
    renderWithProviders(<BooksToBuyRow book={crowded} />);

    await userEvent.click(screen.getByRole("button", { name: MENU_LABEL }));

    expect(
      await screen.findByRole("menuitem", { name: "Магазини та ціни (20)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Додати посилання" })).not.toBeInTheDocument();
  });
});

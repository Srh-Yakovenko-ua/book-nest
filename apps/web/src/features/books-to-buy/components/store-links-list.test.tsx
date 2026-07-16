import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeStoreLink, makeWishlistBook } from "../model/books-to-buy.fixtures";
import { StoreLinksList } from "./store-links-list";

type ListProps = Parameters<typeof StoreLinksList>[0];

function manyLinks(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeStoreLink({
      id: `link-${index}`,
      storeName: `Магазин ${index + 1}`,
      url: `https://store-${index}.example.com/book`,
    }),
  );
}

function renderList(overrides: Partial<ListProps> = {}) {
  const props: ListProps = {
    bestOffer: null,
    book: makeWishlistBook(),
    storeLinks: [makeStoreLink()],
    ...overrides,
  };
  return renderWithProviders(<StoreLinksList {...props} />);
}

describe("StoreLinksList", () => {
  it("hints that no store link has been added yet", () => {
    renderList({ storeLinks: [] });

    expect(screen.getByText("Посилання на магазини ще не додані")).toBeInTheDocument();
  });

  it("marks the link that carries the best offer", () => {
    renderList({
      bestOffer: { currency: "UAH", price: 300 },
      storeLinks: [
        makeStoreLink({
          id: "expensive",
          price: 500,
          storeName: "Yakaboo",
          url: "https://yakaboo.ua/book",
        }),
        makeStoreLink({
          id: "cheap",
          price: 300,
          storeName: "Книгарня Є",
          url: "https://book-ye.com.ua/book",
        }),
      ],
    });

    const cheapest = screen.getByRole("link", { name: /Книгарня Є/ });
    expect(within(cheapest).getByText("Найкраща ціна")).toBeInTheDocument();
  });

  it("leaves the pricier links unmarked", () => {
    renderList({
      bestOffer: { currency: "UAH", price: 300 },
      storeLinks: [
        makeStoreLink({
          id: "expensive",
          price: 500,
          storeName: "Yakaboo",
          url: "https://yakaboo.ua/book",
        }),
        makeStoreLink({
          id: "cheap",
          price: 300,
          storeName: "Книгарня Є",
          url: "https://book-ye.com.ua/book",
        }),
      ],
    });

    const pricier = screen.getByRole("link", { name: /Yakaboo/ });
    expect(within(pricier).queryByText("Найкраща ціна")).not.toBeInTheDocument();
  });

  it("shows only the first three links and counts the rest", () => {
    renderList({ storeLinks: manyLinks(5) });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Ще 2" })).toHaveAttribute("aria-expanded", "false");
  });

  it("reveals the remaining links when expanded", async () => {
    renderList({ storeLinks: manyLinks(5) });

    await userEvent.click(screen.getByRole("button", { name: "Ще 2" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Згорнути" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("hides the extra links again when collapsed", async () => {
    renderList({ storeLinks: manyLinks(5) });

    await userEvent.click(screen.getByRole("button", { name: "Ще 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Згорнути" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("offers no toggle when every link already fits", () => {
    renderList({ storeLinks: manyLinks(3) });

    expect(screen.queryByRole("button", { name: /Ще/ })).not.toBeInTheDocument();
  });

  it("renders a non-https store link as plain text instead of a link", () => {
    renderList({
      storeLinks: [makeStoreLink({ storeName: "Yakaboo", url: "http://yakaboo.ua/book" })],
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Yakaboo")).toBeInTheDocument();
  });

  it("opens an https store link in a new tab", () => {
    renderList({
      storeLinks: [makeStoreLink({ storeName: "Yakaboo", url: "https://yakaboo.ua/book" })],
    });

    const link = screen.getByRole("link", { name: /Yakaboo/ });
    expect(link).toHaveAttribute("href", "https://yakaboo.ua/book");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows the price of a link with the store currency", () => {
    renderList({ storeLinks: [makeStoreLink({ currency: "USD", price: 12 })] });

    expect(screen.getByText("12 $")).toBeInTheDocument();
  });

  it("shows no price for a link that has none", () => {
    renderList({ storeLinks: [makeStoreLink({ currency: null, price: null })] });

    expect(screen.queryByText(/грн/)).not.toBeInTheDocument();
  });
});

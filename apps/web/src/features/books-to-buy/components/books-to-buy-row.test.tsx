import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

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

let respondToRemove: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openRemoveDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Інші дії для «Останнє бажання»" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Прибрати зі списку бажань" }));
}

function removeCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}/ownership/remove-from-wishlist`) &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

beforeEach(() => {
  respondToRemove = () => jsonResponse(makeBookView({ id: book.id, ownershipStatus: "owned" }));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/ownership/remove-from-wishlist") && method === "POST")
      return Promise.resolve(respondToRemove());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
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

    expect(screen.getByRole("link", { name: /Останнє бажання/ })).toHaveAttribute(
      "href",
      `/books/${book.id}`,
    );
  });

  it("offers to add a store link while the book is under the link limit", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    await userEvent.click(screen.getByRole("button", { name: "Інші дії для «Останнє бажання»" }));

    expect(await screen.findByRole("menuitem", { name: "Додати посилання" })).toBeInTheDocument();
  });

  it("hides the add-link action once the book reached the store-link limit", async () => {
    const crowded = makeWishlistBook({
      storeLinks: Array.from({ length: 20 }, (_, index) =>
        makeStoreLink({ id: `link-${index}`, url: `https://store-${index}.example.com/book` }),
      ),
      title: "Останнє бажання",
    });
    renderWithProviders(<BooksToBuyRow book={crowded} />);

    await userEvent.click(screen.getByRole("button", { name: "Інші дії для «Останнє бажання»" }));

    await screen.findByRole("menuitem", { name: "Позначити як в дорозі" });
    expect(screen.queryByRole("menuitem", { name: "Додати посилання" })).not.toBeInTheDocument();
  });

  it("removes the book from the wishlist once the removal is confirmed", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    await openRemoveDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Прибрати зі списку" }));

    await waitFor(() => expect(removeCall()).toBeDefined());
    expect(toast.success).toHaveBeenCalledWith("Книгу прибрано зі списку бажань");
  });

  it("keeps the book when the removal dialog is dismissed", async () => {
    renderWithProviders(<BooksToBuyRow book={book} />);

    await openRemoveDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    expect(removeCall()).toBeUndefined();
  });

  it("reports that the book already left the wishlist", async () => {
    respondToRemove = () => jsonResponse({ code: "NOT_IN_WISHLIST", message: "gone" }, 409);
    renderWithProviders(<BooksToBuyRow book={book} />);

    await openRemoveDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Прибрати зі списку" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Ця книга більше не в списку бажань"),
    );
  });

  it("reports a failed removal", async () => {
    respondToRemove = () => jsonResponse({ message: "boom" }, 500);
    renderWithProviders(<BooksToBuyRow book={book} />);

    await openRemoveDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Прибрати зі списку" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Не вдалося прибрати книгу зі списку бажань"),
    );
  });
});

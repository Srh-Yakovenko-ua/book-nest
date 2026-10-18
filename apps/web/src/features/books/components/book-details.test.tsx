import "@testing-library/jest-dom/vitest";

import type { QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeQuote } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { BookDetails } from "./book-details";
import { makeBookDetailsView } from "./book-details.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const PATHS = {
  bookQuotes: `/api/books/${BOOK_ID}/quotes`,
  chapters: `/api/books/${BOOK_ID}/chapters`,
  detail: `/api/books/${BOOK_ID}`,
  facets: "/api/quotes/facets",
  list: "/api/quotes",
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let serverQuotes: QuoteView[];

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function quotesTabNamed(count: number): Promise<HTMLElement> {
  return screen.findByRole("tab", { name: new RegExp(`^Цитати\\s*, ${count}$`) });
}

function reply(url: URL, method: string, init?: RequestInit): Promise<Response> {
  if (method === "GET" && url.pathname === PATHS.detail) {
    return json(makeBookDetailsView({ id: BOOK_ID, quotesCount: serverQuotes.length }));
  }
  if (method === "GET" && url.pathname === PATHS.list) {
    return json({
      items: serverQuotes,
      page: 1,
      pagesCount: serverQuotes.length === 0 ? 0 : 1,
      pageSize: 20,
      totalCount: serverQuotes.length,
    });
  }
  if (method === "POST" && url.pathname === PATHS.bookQuotes) {
    const input: unknown = JSON.parse(String(init?.body));
    const text = typeof input === "object" && input !== null && "text" in input ? input.text : "";
    const created = makeQuote({ bookId: BOOK_ID, id: "quote-new", text: String(text) });
    serverQuotes = [created, ...serverQuotes];
    return json(created, 201);
  }
  if (method === "DELETE" && url.pathname.startsWith(`${PATHS.bookQuotes}/`)) {
    const quoteId = url.pathname.split("/").at(-1);
    serverQuotes = serverQuotes.filter((quote) => quote.id !== quoteId);
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (method === "GET" && url.pathname === PATHS.chapters) return json({ chapters: [] });
  return json({ message: "not found" }, 404);
}

beforeEach(() => {
  serverQuotes = [
    makeQuote({ bookId: BOOK_ID, id: "quote-1", text: "Страх — убивця розуму." }),
    makeQuote({ bookId: BOOK_ID, id: "quote-2", text: "Спайс мусить текти." }),
  ];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
    reply(
      new URL(String(input), "http://localhost"),
      String(init?.method ?? "GET").toUpperCase(),
      init,
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookDetails quotes badge", () => {
  it("counts a new quote and drops a deleted one from the quotes tab badge", async () => {
    renderWithProviders(
      <NuqsTestingAdapter hasMemory searchParams="?tab=quotes">
        <BookDetails id={BOOK_ID} />
      </NuqsTestingAdapter>,
    );

    expect(await quotesTabNamed(2)).toHaveAttribute("aria-selected", "true");
    await screen.findByText("Страх — убивця розуму.");

    await userEvent.click(screen.getByRole("button", { name: "Додати цитату" }));
    const dialog = await screen.findByRole("dialog", { name: "Додати цитату" });
    await userEvent.type(within(dialog).getByLabelText(/Текст цитати/), "Нова цитата.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти цитату" }));

    expect(await quotesTabNamed(3)).toBeInTheDocument();
    expect(await screen.findByText("Нова цитата.")).toBeInTheDocument();

    const newCard = screen.getByText("Нова цитата.").closest("article");
    if (newCard === null) throw new Error("no card for the new quote");
    await userEvent.click(within(newCard).getByRole("button", { name: "Дії для цитати" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Видалити" }));

    expect(await quotesTabNamed(2)).toBeInTheDocument();
  });
});

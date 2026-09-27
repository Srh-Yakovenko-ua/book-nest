import "@testing-library/jest-dom/vitest";

import type { BookView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookSelectOption } from "@/features/books/model/book-select-option";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeQuote } from "../model/quotes.fixtures";
import { QuoteDialog } from "./quote-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const PICKED_BOOK = makeBookView({
  authors: [{ id: "author-1", name: "Френк Герберт" }],
  id: "picked-book",
  title: "Месія Дюни",
});

const QUOTE = makeQuote();
const QUOTE_BOOK: BookSelectOption = {
  authorName: QUOTE.book.firstAuthorName,
  cover: QUOTE.book.cover,
  id: QUOTE.book.id,
  title: QUOTE.book.title,
};

const fetchMock = vi.fn();

function booksPage(items: BookView[]): Response {
  return jsonResponse({
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: items.length,
  });
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog");
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function submitButton(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function writeRequests(): { method: string; url: string }[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({
      method: String((init as RequestInit | undefined)?.method ?? "GET").toUpperCase(),
      url: String(input),
    }))
    .filter((call) => call.method !== "GET");
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" || method === "PATCH") return Promise.resolve(jsonResponse(QUOTE));
    if (url.startsWith("/api/books?")) return Promise.resolve(booksPage([PICKED_BOOK]));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("QuoteDialog create mode with the book picker", () => {
  function renderCreate() {
    return renderWithProviders(
      <QuoteDialog mode="createWithBookPicker" onOpenChange={vi.fn()} open />,
    );
  }

  async function pickBook() {
    await userEvent.click(await screen.findByRole("radio", { name: "Месія Дюни Френк Герберт" }));
  }

  it("refuses to submit without a book and says why", async () => {
    renderCreate();
    await screen.findByRole("radio", { name: "Месія Дюни Френк Герберт" });

    await userEvent.type(screen.getByLabelText(/Текст цитати/), "Страх — убивця розуму.");
    await userEvent.click(submitButton("Зберегти цитату"));

    expect(await within(dialog()).findByText("Оберіть книгу")).toBeInTheDocument();
    expect(writeRequests()).toHaveLength(0);

    await pickBook();
    await waitFor(() => expect(submitButton("Зберегти цитату")).toBeEnabled());
  });

  it("keeps focus in the form and moves it to the book field when the submit fails", async () => {
    renderCreate();
    await screen.findByRole("radio", { name: "Месія Дюни Френк Герберт" });

    await userEvent.type(screen.getByLabelText(/Текст цитати/), "Страх — убивця розуму.");
    await userEvent.click(submitButton("Зберегти цитату"));

    await within(dialog()).findByText("Оберіть книгу");
    expect(submitButton("Зберегти цитату")).toBeEnabled();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Пошук за назвою або автором" }),
    );
  });

  it("marks the required fields as required for assistive tech", async () => {
    renderCreate();
    await screen.findByRole("radio", { name: "Месія Дюни Френк Герберт" });

    expect(screen.getByRole("radiogroup", { name: "Ваші книги" })).toHaveAttribute(
      "aria-required",
      "true",
    );
    expect(screen.getByLabelText(/Текст цитати/)).toHaveAttribute("aria-required", "true");
  });

  it("posts the quote to the chosen book", async () => {
    renderCreate();
    await pickBook();
    await userEvent.type(screen.getByLabelText(/Текст цитати/), "Страх — убивця розуму.");

    await userEvent.click(submitButton("Зберегти цитату"));

    await waitFor(() => expect(writeRequests()).toHaveLength(1));
    expect(writeRequests()).toEqual([{ method: "POST", url: "/api/books/picked-book/quotes" }]);
  });

  it("shows the chosen book once, without a second preview", async () => {
    renderCreate();

    await pickBook();

    expect(within(dialog()).getAllByText("Месія Дюни")).toHaveLength(1);
  });

  it("renders the picker inline, without opening a second dialog", async () => {
    renderCreate();
    await screen.findByRole("radio", { name: "Месія Дюни Френк Герберт" });

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog()).getByRole("radiogroup", { name: "Ваші книги" })).toBeInTheDocument();
  });
});

describe("QuoteDialog edit mode", () => {
  function renderEdit() {
    return renderWithProviders(
      <QuoteDialog book={QUOTE_BOOK} mode="edit" onOpenChange={vi.fn()} open quote={QUOTE} />,
    );
  }

  it("shows the quote's book without any search field", () => {
    renderEdit();

    expect(within(dialog()).getByText("Дюна")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Пошук за назвою або автором")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ваші книги" })).not.toBeInTheDocument();
  });

  it("offers no affordance to move the quote to another book", () => {
    renderEdit();

    expect(screen.queryByRole("button", { name: "Змінити" })).not.toBeInTheDocument();
  });

  it("shows the quote's book once, without a second preview", () => {
    renderEdit();

    expect(within(dialog()).getAllByText("Дюна")).toHaveLength(1);
  });

  it("patches the quote on its owning book", async () => {
    renderEdit();

    await userEvent.type(screen.getByLabelText(/Текст цитати/), " Продовження.");
    await userEvent.click(submitButton("Зберегти зміни"));

    await waitFor(() => expect(writeRequests()).toHaveLength(1));
    expect(writeRequests()).toEqual([{ method: "PATCH", url: "/api/books/book-1/quotes/quote-1" }]);
  });
});

import "@testing-library/jest-dom/vitest";

import type { QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeQuote, stubTextMetrics } from "../../model/quotes.fixtures";
import { QuoteArchiveCard } from "./quote-archive-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const QUOTE_TEXT = "Страх — убивця розуму.";

const fetchMock = vi.fn();
const writeText = vi.fn();

let restoreMetrics: () => void = () => undefined;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Дії для цитати" }));
}

function quoteCall(method: string) {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/books/book-1/quotes/quote-1") &&
      String(init?.method ?? "GET").toUpperCase() === method,
  ) as [string, RequestInit] | undefined;
}

function renderCard(overrides: Partial<QuoteView> = {}) {
  return renderWithProviders(<QuoteArchiveCard quote={makeQuote(overrides)} />);
}

function updateBody(): unknown {
  const call = quoteCall("PATCH");
  if (call === undefined) throw new Error("no PATCH call was made");
  return JSON.parse(String(call[1].body));
}

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/books/book-1/quotes/quote-1") && method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as Partial<QuoteView>;
      return Promise.resolve(jsonResponse(makeQuote(body)));
    }
    if (url.includes("/api/books/book-1/quotes/quote-1") && method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("QuoteArchiveCard content", () => {
  it("shows the book title, the author and the quote text", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Дюна" })).toBeInTheDocument();
    expect(screen.getByText("Френк Герберт")).toBeInTheDocument();
    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
  });

  it("joins the chapter and the page into one meta line", () => {
    renderCard({ chapter: "Розділ III", page: 87 });

    expect(screen.getByText("Розділ III · стор. 87")).toBeInTheDocument();
  });

  it("leaves the page out of the meta line when the quote has no page", () => {
    renderCard({ chapter: "Розділ III", page: null });

    expect(screen.getByText("Розділ III")).toBeInTheDocument();
    expect(screen.queryByText(/стор\./)).not.toBeInTheDocument();
  });

  it("falls back to the unknown-author label when the book has no author", () => {
    renderCard({ book: { ...makeQuote().book, firstAuthorName: "" } });

    expect(screen.getByText("Автор невідомий")).toBeInTheDocument();
  });

  it("links the cover and the title to the book page", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Дюна" })).toHaveAttribute("href", "/books/book-1");
    expect(screen.getByRole("link", { name: "Обкладинка книги «Дюна»" })).toHaveAttribute(
      "href",
      "/books/book-1",
    );
  });

  it("shows the comment under its own label", () => {
    renderCard({ comment: "Улюблена мантра проти страху." });

    expect(screen.getByText("Коментар")).toBeInTheDocument();
    expect(screen.getByText("Улюблена мантра проти страху.")).toBeInTheDocument();
  });

  it("renders no comment block for a quote without a comment", () => {
    renderCard({ comment: null });

    expect(screen.queryByText("Коментар")).not.toBeInTheDocument();
  });

  it("offers only the favorite and the actions menu on the card itself", () => {
    renderCard();

    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.textContent || button.getAttribute("aria-label")),
    ).toEqual(["Додати цитату в улюблені", "Дії для цитати"]);
  });

  it("keeps the book link inside the actions menu instead of the card body", () => {
    renderCard();

    expect(screen.queryByText("Перейти до книги")).not.toBeInTheDocument();
    expect(screen.queryByText("До книги")).not.toBeInTheDocument();
  });
});

describe("QuoteArchiveCard spoilers", () => {
  it("hides the text of a spoiler quote behind the gate", () => {
    renderCard({ isSpoiler: true });

    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText("Ця цитата містить спойлер")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показати цитату" })).toBeInTheDocument();
  });

  it("marks a spoiler quote with the spoiler badge", () => {
    renderCard({ isSpoiler: true });

    expect(screen.getByText("Спойлер")).toBeInTheDocument();
  });

  it("keeps the comment readable while the spoiler text stays hidden", () => {
    renderCard({ comment: "Найсильніша сцена книги.", isSpoiler: true });

    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText("Найсильніша сцена книги.")).toBeInTheDocument();
  });

  it("carries no spoiler wording at all for an ordinary quote", () => {
    renderCard({ isSpoiler: false });

    expect(screen.queryByText("Без спойлерів")).not.toBeInTheDocument();
    expect(screen.queryByText("Спойлер")).not.toBeInTheDocument();
  });
});

describe("QuoteArchiveCard long text", () => {
  it("offers the full view when the text outgrows the clamp", () => {
    restoreMetrics = stubTextMetrics({ clientHeight: 100, scrollHeight: 500 });

    renderCard();

    expect(screen.getByRole("button", { name: "Показати повністю" })).toBeInTheDocument();
  });
});

describe("QuoteArchiveCard favorite", () => {
  it("labels the heart as an addition for a quote that is not favorite", () => {
    renderCard({ isFavorite: false });

    expect(screen.getByRole("button", { name: "Додати цитату в улюблені" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("labels the heart as a removal for a favorite quote", () => {
    renderCard({ isFavorite: true });

    expect(screen.getByRole("button", { name: "Прибрати цитату з улюблених" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("asks the API to mark the quote favorite", async () => {
    renderCard({ isFavorite: false });

    await userEvent.click(screen.getByRole("button", { name: "Додати цитату в улюблені" }));

    await waitFor(() => expect(quoteCall("PATCH")).toBeDefined());
    expect(updateBody()).toEqual({ isFavorite: true });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Цитату додано в улюблені"));
  });

  it("asks the API to drop a favorite quote from favorites", async () => {
    renderCard({ isFavorite: true });

    await userEvent.click(screen.getByRole("button", { name: "Прибрати цитату з улюблених" }));

    await waitFor(() => expect(quoteCall("PATCH")).toBeDefined());
    expect(updateBody()).toEqual({ isFavorite: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Цитату прибрано з улюблених"));
  });
});

describe("QuoteArchiveCard actions menu", () => {
  it("offers editing, the book, copying and deletion", async () => {
    renderCard();

    await openMenu();

    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "Редагувати",
      "Перейти до книги",
      "Скопіювати цитату",
      "Видалити",
    ]);
  });

  it("links the menu entry to the book page", async () => {
    renderCard();

    await openMenu();

    expect(await screen.findByRole("menuitem", { name: "Перейти до книги" })).toHaveAttribute(
      "href",
      "/books/book-1",
    );
  });

  it("copies the quote text and confirms it with a toast", async () => {
    renderCard();

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Скопіювати цитату" }));

    expect(writeText).toHaveBeenCalledWith(QUOTE_TEXT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Цитату скопійовано"));
  });

  it("reports a blocked clipboard", async () => {
    writeText.mockRejectedValue(new Error("blocked"));
    renderCard();

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Скопіювати цитату" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося скопіювати цитату"));
  });

  it("opens the edit dialog", async () => {
    renderCard();

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Редагувати" }));

    expect(await screen.findByRole("dialog", { name: "Редагувати цитату" })).toBeInTheDocument();
  });

  it("asks for confirmation before deleting", async () => {
    renderCard();

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));

    expect(await screen.findByRole("alertdialog")).toHaveAccessibleName("Видалити цитату?");
    expect(quoteCall("DELETE")).toBeUndefined();
  });

  it("deletes the quote once the confirmation is accepted", async () => {
    renderCard();

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(await within(confirmation).findByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(quoteCall("DELETE")).toBeDefined());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Цитату видалено"));
  });
});

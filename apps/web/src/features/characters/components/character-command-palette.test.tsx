import "@testing-library/jest-dom/vitest";
import type { BookCharacterSummaryQuery } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { toCharacterReadingContext } from "../model/characters-roster-query";
import { makeCharacterSummary, makeCharacterSummaryPage } from "../model/characters.fixtures";
import { CharacterCommandPalette } from "./character-command-palette";

const PALETTE_HINT = "Почніть вводити ім'я персонажа";
const SETTLE_MS = 100;

const bookInProgress = makeBookView({
  id: "book-1",
  readingProgress: {
    abandonedAt: null,
    currentPage: 42,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: null,
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: null,
  },
  readingStatus: "reading",
});
const finishedBook = makeBookView({ id: "book-1" });

const geralt = makeCharacterSummary({ characterId: "char-1", id: "book-char-1", name: "Ґеральт" });
const ciri = makeCharacterSummary({ characterId: "char-9", id: "book-char-9", name: "Цірі" });

const fetchMock = vi.fn();

let respondToRoster: (url: string) => Promise<Response> | Response;

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  const controls: { resolve?: (response: Response) => void } = {};
  const promise = new Promise<Response>((resolve) => {
    controls.resolve = resolve;
  });
  return { promise, resolve: (response) => controls.resolve?.(response) };
}

function globalSearchRequestUrls(): string[] {
  return requestUrls().filter((url) => url.includes("/api/characters?"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function paramOf(url: string | undefined, name: string): null | string {
  if (url === undefined) return null;
  return new URL(url, "http://localhost").searchParams.get(name);
}

function renderPalette(readingContext: BookCharacterSummaryQuery = {}) {
  const onOpenChange = vi.fn();
  const onSelect = vi.fn();
  const view = renderWithProviders(
    <CharacterCommandPalette
      bookId="book-1"
      onOpenChange={onOpenChange}
      onSelect={onSelect}
      open
      readingContext={readingContext}
    />,
  );
  return { ...view, onOpenChange, onSelect };
}

function requestUrls(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => ((init as RequestInit | undefined)?.method ?? "GET") === "GET")
    .map(([input]) => String(input));
}

function rosterRequestUrls(): string[] {
  return requestUrls().filter((url) => url.includes("/api/books/book-1/characters?"));
}

async function settleRequests() {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

async function typeQuery(text: string) {
  await userEvent.type(screen.getByRole("combobox"), text);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  respondToRoster = () => jsonResponse(makeCharacterSummaryPage([geralt]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.includes("/api/books/book-1/characters?")) {
      return Promise.resolve(respondToRoster(url));
    }
    if (method === "GET" && url.includes("/api/characters?")) {
      return Promise.resolve(jsonResponse(makeCharacterSummaryPage([])));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterCommandPalette scope", () => {
  it("searches this book's roster and never the global characters list", async () => {
    renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("Ґе");

    expect(await screen.findByRole("option", { name: /Ґеральт/ })).toBeInTheDocument();
    expect(rosterRequestUrls().length).toBeGreaterThan(0);
    expect(globalSearchRequestUrls()).toHaveLength(0);
  });

  it("stays book-scoped for a book with no reading position instead of searching globally", async () => {
    renderPalette(toCharacterReadingContext(finishedBook));

    await typeQuery("Ґе");

    expect(await screen.findByRole("option", { name: /Ґеральт/ })).toBeInTheDocument();
    expect(globalSearchRequestUrls()).toHaveLength(0);
    expect(paramOf(rosterRequestUrls()[0], "contextBookId")).toBeNull();
    expect(paramOf(rosterRequestUrls()[0], "contextPage")).toBeNull();
  });

  it("sends one normalized query, the same reading context, and a small finite page the roster asks for", async () => {
    renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("  Ґ   е  ");

    await waitFor(() => expect(rosterRequestUrls()).toHaveLength(1));
    const url = rosterRequestUrls()[0];
    expect(paramOf(url, "contextBookId")).toBe("book-1");
    expect(paramOf(url, "contextPage")).toBe("42");
    expect(paramOf(url, "search")).toBe("Ґ е");
    expect(paramOf(url, "pageNumber")).toBe("1");
    expect(paramOf(url, "pageSize")).toBe("10");
  });

  it("asks the server for nothing below two characters", async () => {
    renderPalette(toCharacterReadingContext(bookInProgress));

    expect(screen.getByText(PALETTE_HINT)).toBeInTheDocument();
    expect(requestUrls()).toHaveLength(0);

    await typeQuery("Ґ");
    await settleRequests();

    expect(requestUrls()).toHaveLength(0);
    expect(screen.getByText(PALETTE_HINT)).toBeInTheDocument();
  });
});

describe("CharacterCommandPalette results", () => {
  it("opens the row by its global character id", async () => {
    respondToRoster = () => jsonResponse(makeCharacterSummaryPage([ciri]));
    const { onOpenChange, onSelect } = renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("Ці");
    await userEvent.click(await screen.findByRole("option", { name: /Цірі/ }));

    expect(onSelect).toHaveBeenCalledWith("char-9");
    expect(onSelect).not.toHaveBeenCalledWith("book-char-9");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("labels a row with its importance", async () => {
    respondToRoster = () =>
      jsonResponse(
        makeCharacterSummaryPage([
          geralt,
          makeCharacterSummary({
            characterId: "char-2",
            id: "book-char-2",
            importance: "not_specified",
            name: "Єнніфер",
          }),
        ]),
      );
    renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("Ґе");

    const geraltRow = await screen.findByRole("option", { name: /Ґеральт/ });
    expect(within(geraltRow).getByText("Центральний")).toBeInTheDocument();

    const yenneferRow = screen.getByRole("option", { name: /Єнніфер/ });
    expect(within(yenneferRow).queryByText("Не вказано")).not.toBeInTheDocument();
  });

  it("never shows a roster character the reader cannot have reached yet", async () => {
    respondToRoster = (url) =>
      jsonResponse(
        makeCharacterSummaryPage(paramOf(url, "contextPage") === "42" ? [geralt] : [geralt, ciri]),
      );
    renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("Ґе");

    expect(await screen.findByRole("option", { name: /Ґеральт/ })).toBeInTheDocument();
    await settleRequests();
    expect(screen.queryByRole("option", { name: /Цірі/ })).not.toBeInTheDocument();
  });

  it("never renders a slower query's rows as the current query's results", async () => {
    const held = deferredResponse();
    respondToRoster = (url) =>
      paramOf(url, "search") === "Ґе"
        ? held.promise
        : jsonResponse(makeCharacterSummaryPage([geralt]));
    renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("Ґе");
    await waitFor(() => expect(rosterRequestUrls()).toHaveLength(1));

    await typeQuery("р");
    expect(await screen.findByRole("option", { name: /Ґеральт/ })).toBeInTheDocument();

    held.resolve(jsonResponse(makeCharacterSummaryPage([ciri])));
    await settleRequests();

    expect(screen.queryByRole("option", { name: /Цірі/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Ґеральт/ })).toBeInTheDocument();
  });

  it("clears the query when the palette closes", async () => {
    renderPalette(toCharacterReadingContext(bookInProgress));

    await typeQuery("Ґе");
    await screen.findByRole("option", { name: /Ґеральт/ });

    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByText(PALETTE_HINT)).toBeInTheDocument();
  });
});

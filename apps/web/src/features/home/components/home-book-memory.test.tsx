import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookNote } from "@/features/notes/model/notes.fixtures";
import { makeQuote } from "@/features/quotes/model/quotes.fixtures";
import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test-utils";

import type { HomeBookMemoryState } from "./home-book-memory";

import { HomeBookMemory } from "./home-book-memory";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }),
}));

const { enterViewport } = mockIntersectionObserver();

const memory = messages.home.memory;
const QUOTE_TEXT = /убивця розуму/;
const NOTE_TEXT = "Пол бачить усі можливі майбутні одночасно.";
const NOTE_TITLE = "Видіння Пола";
const QUOTE_IMPRESSION_PATH = "/api/quotes/rediscovery/impression";
const NOTE_IMPRESSION_PATH = "/api/notes/rediscovery/impression";

const fetchMock = vi.fn();

function expectNowhere(content: RegExp | string) {
  expect(screen.queryByText(content)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(content)).not.toBeInTheDocument();
  expect(screen.queryByTitle(content)).not.toBeInTheDocument();
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function noteSelection(overrides: Parameters<typeof makeBookNote>[0] = {}): HomeBookMemoryState {
  return {
    kind: "note",
    memory: {
      impressionKey: "note-1:2026-11-24",
      note: makeBookNote({ text: NOTE_TEXT, title: NOTE_TITLE, ...overrides }),
      source: {
        authors: [{ id: "author-1", name: "Френк Герберт" }],
        cover: null,
        id: "book-1",
        seriesPosition: null,
        title: "Дюна",
        type: "book",
      },
    },
  };
}

function quoteSelection(overrides: Parameters<typeof makeQuote>[0] = {}): HomeBookMemoryState {
  return { kind: "quote", quote: makeQuote(overrides) };
}

function requestsTo(path: string) {
  return sentRequests().filter((request) => request.url.includes(path));
}

function sentRequests() {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    method: (init?.method ?? "GET").toUpperCase(),
    url: String(input),
  }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function showMemory(selection: HomeBookMemoryState) {
  return renderWithProviders(
    <HomeBookMemory isRetrying={false} onRetry={vi.fn()} selection={selection} />,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes(QUOTE_IMPRESSION_PATH) || url.includes(NOTE_IMPRESSION_PATH))
      return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes("/api/books/book-1/quotes/quote-1") && method !== "GET")
      return Promise.resolve(jsonResponse(makeQuote({ isFavorite: true })));
    if (url.includes("/api/notes/note-1") && method !== "GET")
      return Promise.resolve(
        jsonResponse(makeBookNote({ isFavorite: true, text: NOTE_TEXT, title: NOTE_TITLE })),
      );
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomeBookMemory spoiler quote", () => {
  it("keeps the quote text, page, chapter and comment out of the page until revealed", () => {
    showMemory(
      quoteSelection({
        chapter: "Розділ IX",
        comment: "Ключ до фіналу",
        isSpoiler: true,
        page: 412,
      }),
    );

    expect(screen.getByText(memory.spoiler.title)).toBeInTheDocument();
    expectNowhere(QUOTE_TEXT);
    expectNowhere(/Розділ IX/);
    expectNowhere(/412/);
    expectNowhere(/Ключ до фіналу/);
    expect(screen.queryByRole("button", { name: memory.favorite })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: memory.openFull })).not.toBeInTheDocument();
  });

  it("shows the quote after reveal without sending a request", async () => {
    showMemory(quoteSelection({ isSpoiler: true }));

    await userEvent.click(screen.getByRole("button", { name: memory.spoiler.reveal }));

    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records no impression while hidden and one once revealed in view", async () => {
    showMemory(quoteSelection({ isSpoiler: true }));

    enterViewport();
    await settle();
    expect(requestsTo(QUOTE_IMPRESSION_PATH)).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: memory.spoiler.reveal }));

    await waitFor(() => expect(requestsTo(QUOTE_IMPRESSION_PATH)).toHaveLength(1));
  });
});

describe("HomeBookMemory spoiler note", () => {
  it("keeps the note title and text out of the page until revealed", async () => {
    showMemory(noteSelection({ isSpoiler: true }));

    expectNowhere(NOTE_TITLE);
    expectNowhere(NOTE_TEXT);

    await userEvent.click(screen.getByRole("button", { name: memory.spoiler.reveal }));

    expect(screen.getByRole("heading", { name: NOTE_TITLE })).toBeInTheDocument();
    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("HomeBookMemory impressions", () => {
  it("records one impression for the quote shown", async () => {
    showMemory(quoteSelection());

    enterViewport();

    await waitFor(() => expect(requestsTo(QUOTE_IMPRESSION_PATH)).toHaveLength(1));
    expect(requestsTo(QUOTE_IMPRESSION_PATH)[0]?.body).toEqual({ quoteId: "quote-1" });
  });

  it("records one impression for the note shown", async () => {
    showMemory(noteSelection());

    enterViewport();

    await waitFor(() => expect(requestsTo(NOTE_IMPRESSION_PATH)).toHaveLength(1));
    expect(requestsTo(NOTE_IMPRESSION_PATH)[0]?.body).toEqual({
      impressionKey: "note-1:2026-11-24",
    });
  });

  it("records nothing while the memory is out of view", async () => {
    showMemory(quoteSelection());

    expect(await screen.findByText(QUOTE_TEXT)).toBeInTheDocument();
    await settle();
    expect(requestsTo(QUOTE_IMPRESSION_PATH)).toHaveLength(0);
  });
});

describe("HomeBookMemory favorite", () => {
  it("favorites the quote itself, not its book", async () => {
    showMemory(quoteSelection());

    await userEvent.click(screen.getByRole("button", { name: memory.favorite }));

    await waitFor(() => expect(requestsTo("/api/books/book-1/quotes/quote-1")).toHaveLength(1));
    expect(requestsTo("/api/books/book-1/quotes/quote-1")[0]?.body).toEqual({ isFavorite: true });
    expect(sentRequests().filter((request) => !request.url.includes("/quotes/"))).toHaveLength(0);
  });

  it("favorites the note itself, not its book", async () => {
    showMemory(noteSelection());

    await userEvent.click(screen.getByRole("button", { name: memory.favorite }));

    await waitFor(() => expect(requestsTo("/api/notes/note-1")).toHaveLength(1));
    expect(requestsTo("/api/notes/note-1")[0]?.body).toEqual({ isFavorite: true });
    expect(requestsTo("/api/books/")).toHaveLength(0);
  });
});

describe("HomeBookMemory full view", () => {
  it("opens the quote in full", async () => {
    showMemory(quoteSelection());

    await userEvent.click(screen.getByRole("button", { name: memory.openFull }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(QUOTE_TEXT);
  });

  it("opens the note in full", async () => {
    showMemory(noteSelection());

    await userEvent.click(screen.getByRole("button", { name: memory.openFull }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(NOTE_TITLE);
  });
});

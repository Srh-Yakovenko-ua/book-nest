import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import {
  makeBookCharacterSummary,
  makeCharacterSummary,
  makeCharacterSummaryPage,
} from "../model/characters.fixtures";
import { BookCharactersTab } from "./book-characters-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const book = makeBookView({ id: "book-1" });
const fetchMock = vi.fn();

let respondToRoster: () => Response;
let respondToSummary: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderTab(search = "", tabBook = book) {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <BookCharactersTab book={tabBook} />
    </NuqsTestingAdapter>,
  );
}

function rosterRequestUrl(): string {
  const call = fetchMock.mock.calls.find(
    ([input]) => String(input).includes("/characters?") && !String(input).includes("summary"),
  );
  return String(call?.[0]);
}

beforeEach(() => {
  respondToRoster = () => jsonResponse(makeCharacterSummaryPage([makeCharacterSummary()]));
  respondToSummary = () => jsonResponse(makeBookCharacterSummary());

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/character-summary")) return Promise.resolve(respondToSummary());
    if (method === "GET" && url.includes("/characters?")) return Promise.resolve(respondToRoster());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookCharactersTab roster", () => {
  it("shows loading skeletons while the roster is pending, then the character cards", async () => {
    renderTab();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });

  it("shows the empty state with an add affordance when there are no characters", async () => {
    respondToRoster = () => jsonResponse(makeCharacterSummaryPage([]));

    renderTab();

    expect(await screen.findByText("Тут поки немає персонажів")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Додати персонажа" }).length).toBeGreaterThan(0);
  });

  it("shows an error state when the roster request fails", async () => {
    respondToRoster = () => jsonResponse({ message: "boom" }, 500);

    renderTab();

    expect(await screen.findByText("Помилка завантаження")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Спробувати ще раз/ })).toBeInTheDocument();
  });

  it("refetches the roster when the retry button is used", async () => {
    respondToRoster = () => jsonResponse({ message: "boom" }, 500);

    renderTab();

    const retry = await screen.findByRole("button", { name: /Спробувати ще раз/ });
    respondToRoster = () => jsonResponse(makeCharacterSummaryPage([makeCharacterSummary()]));

    await userEvent.click(retry);

    expect(await screen.findByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
  });
});

describe("BookCharactersTab contextual roster", () => {
  it("asks the backend to sort and forwards the reading position of a book in progress", async () => {
    renderTab(
      "",
      makeBookView({
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
      }),
    );

    await screen.findByRole("heading", { name: "Ґеральт" });

    const url = rosterRequestUrl();
    expect(url).toContain("sort=importance");
    expect(url).toContain("contextBookId=book-1");
    expect(url).toContain("contextPage=42");
  });

  it("sends no reading position for a finished book", async () => {
    renderTab();

    await screen.findByRole("heading", { name: "Ґеральт" });

    expect(rosterRequestUrl()).not.toContain("contextPage");
  });

  it("hides the summary and the toolbar for an empty book", async () => {
    respondToRoster = () => jsonResponse(makeCharacterSummaryPage([]));

    renderTab();

    await screen.findByText("Тут поки немає персонажів");

    expect(screen.queryByPlaceholderText("Пошук у цій книзі...")).not.toBeInTheDocument();
    expect(screen.queryByText(/Персонажів:/)).not.toBeInTheDocument();
  });

  it("keeps the toolbar and offers a search reset when a search finds nothing", async () => {
    respondToRoster = () => jsonResponse(makeCharacterSummaryPage([]));

    renderTab("characterSearch=zzz");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук у цій книзі...")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Очистити пошук/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Додати персонажа" })).toHaveLength(1);
  });
});

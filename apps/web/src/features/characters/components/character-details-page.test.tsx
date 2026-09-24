import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen } from "@/test-utils";

import { makeBookCharacterView, makeCharacterDetails } from "../model/characters.fixtures";
import { CharacterDetailsPage } from "./character-details-page";

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

let respondToDetails: () => Response;

function detailsRequestUrl(): string {
  const call = fetchMock.mock.calls.find(([input]) =>
    String(input).includes("/api/characters/char-1"),
  );
  return String(call?.[0]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderPage(search = "") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <CharacterDetailsPage characterId="char-1" />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  respondToDetails = () =>
    jsonResponse(
      makeCharacterDetails({
        appearances: [
          makeBookCharacterView({
            book: { cover: null, id: "book-1", series: null, title: "Останнє бажання" },
            bookId: "book-1",
            importance: "central",
          }),
        ],
      }),
    );

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/books/book-1")) return Promise.resolve(jsonResponse(book));
    if (url.includes("/api/characters/char-1")) return Promise.resolve(respondToDetails());
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CharacterDetailsPage global mode", () => {
  it("renders the profile and the appearances without asking for a book context", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Ґеральт" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Про персонажа" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Появи" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(detailsRequestUrl()).not.toContain("contextBookId");
  });

  it("uses the compact book data of the appearance instead of fetching each book", async () => {
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.getByText("Останнє бажання")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/books/")),
    ).toHaveLength(0);
  });
});

describe("CharacterDetailsPage book context", () => {
  it("shows the book section and forwards the reading position of the context book", async () => {
    renderPage("bookId=book-1");

    expect(await screen.findByRole("heading", { name: "У цій книзі" })).toBeInTheDocument();
    expect(detailsRequestUrl()).toContain("contextBookId=book-1");
  });

  it("drops a context the character does not actually appear in", async () => {
    renderPage("bookId=book-404");

    await screen.findByRole("heading", { level: 1, name: "Ґеральт" });

    expect(screen.queryByRole("heading", { name: "У цій книзі" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Появи" })).toBeInTheDocument();
  });

  it("never names the character when the context request is refused", async () => {
    respondToDetails = () => jsonResponse({ message: "not found" }, 404);

    renderPage("bookId=book-1");

    expect(
      await screen.findByRole("heading", { name: "Персонаж недоступний у цій книзі" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ґеральт")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Відкрити загальний профіль" })).toHaveAttribute(
      "href",
      "/characters/char-1",
    );
  });
});

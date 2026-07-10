import "@testing-library/jest-dom/vitest";

import type { CustomListDetail } from "@app/shared";
import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeCustomListDetail, makeListBookView } from "../model/lists.fixtures";
import { ListDetailsView } from "./list-details-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToRemove: () => Response;

type ViewProps = Parameters<typeof ListDetailsView>[0];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderView(pages: CustomListDetail[], overrides: Partial<ViewProps> = {}) {
  const props: ViewProps = {
    hasNextPage: false,
    id: "list-1",
    isFetching: false,
    isFetchingNextPage: false,
    onClearSearch: vi.fn(),
    onLoadMore: vi.fn(),
    onSearchChange: vi.fn(),
    onSortChange: vi.fn(),
    pages,
    search: "",
    sort: "position",
    ...overrides,
  };
  return renderWithProviders(<ListDetailsView {...props} />);
}

beforeEach(() => {
  respondToRemove = () => new Response(null, { status: 204 });
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/api/lists") && method === "DELETE")
      return Promise.resolve(respondToRemove());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ListDetailsView", () => {
  it("renders the list header and each book with its position", () => {
    renderView([
      makeCustomListDetail({
        books: {
          items: [
            makeListBookView({ id: "b1", position: 1, title: "Перша" }),
            makeListBookView({ id: "b2", position: 2, title: "Друга" }),
          ],
        },
        name: "Мій список",
      }),
    ]);

    expect(screen.getByRole("heading", { level: 1, name: "Мій список" })).toBeInTheDocument();
    expect(screen.getByText("Позиція 1")).toBeInTheDocument();
    expect(screen.getByText("Позиція 2")).toBeInTheDocument();
  });

  it("shows the empty state when the list has no books", () => {
    renderView([makeCustomListDetail({ books: { items: [] }, name: "Порожній список" })]);

    expect(screen.getByText("У цьому списку ще немає книг")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Повернутися до списків" })).toBeInTheDocument();
  });

  it("removes a book and offers an undo action through a toast", async () => {
    renderView([
      makeCustomListDetail({
        books: { items: [makeListBookView({ id: "b1", position: 1, title: "Перша" })] },
      }),
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Дії з книгою: Перша" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Прибрати зі списку" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        "Книгу прибрано зі списку",
        expect.objectContaining({ action: expect.objectContaining({ label: "Скасувати" }) }),
      ),
    );
  });
});

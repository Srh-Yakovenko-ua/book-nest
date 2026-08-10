import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { UnsetOwnershipDialog } from "./unset-ownership-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let pages: { items: unknown[]; totalCount: number }[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function pageBody(pageNumber: number) {
  const page = pages[pageNumber - 1] ?? { items: [], totalCount: 0 };
  return {
    items: page.items,
    page: pageNumber,
    pagesCount: pages.length,
    pageSize: 24,
    totalCount: page.totalCount,
  };
}

beforeEach(() => {
  pages = [
    {
      items: [
        makeBookView({ id: "book-a", ownershipStatus: "none", title: "Дюна" }),
        makeBookView({ id: "book-b", ownershipStatus: "none", title: "Соляріс" }),
      ],
      totalCount: 2,
    },
  ];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.pathname === "/api/books" && method === "GET") {
      return Promise.resolve(
        jsonResponse(pageBody(Number(url.searchParams.get("pageNumber") ?? 1))),
      );
    }
    if (url.pathname === "/api/books/bulk/ownership-status") {
      return Promise.resolve(jsonResponse({ affected: 2 }));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("UnsetOwnershipDialog", () => {
  it("lists only the books whose ownership status is unset", async () => {
    renderWithProviders(<UnsetOwnershipDialog onOpenChange={vi.fn()} open />);

    expect(await screen.findByText("Дюна")).toBeInTheDocument();

    const listRequest = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/books?"),
    );
    expect(String(listRequest?.[0])).toContain("owner=none");
  });

  it("selects every matching book at once", async () => {
    renderWithProviders(<UnsetOwnershipDialog onOpenChange={vi.fn()} open />);
    await screen.findByText("Дюна");

    await userEvent.click(screen.getByRole("button", { name: "Обрати всі" }));

    expect(await screen.findByText("Вибрано книг: 2")).toBeInTheDocument();
  });

  it("sends the chosen status for the selected books", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<UnsetOwnershipDialog onOpenChange={onOpenChange} open />);
    await screen.findByText("Дюна");

    await userEvent.click(screen.getByRole("button", { name: "Обрати всі" }));
    await screen.findByText("Вибрано книг: 2");
    await userEvent.click(screen.getByRole("button", { name: "Призначити статус" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) =>
        String(input).includes("/api/books/bulk/ownership-status"),
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        bookIds: ["book-a", "book-b"],
        ownershipStatus: "owned",
      });
    });
  });

  it("offers no status that the bulk endpoint rejects", async () => {
    renderWithProviders(<UnsetOwnershipDialog onOpenChange={vi.fn()} open />);
    await screen.findByText("Дюна");

    const statusGroup = screen.getByRole("radiogroup", { name: "Який статус призначити?" });
    expect(within(statusGroup).queryByRole("radio", { name: "Позичена у когось" })).toBeNull();
    expect(within(statusGroup).queryByRole("radio", { name: "Видана комусь" })).toBeNull();
    expect(within(statusGroup).queryByRole("radio", { name: "Не вказано" })).toBeNull();
  });
});

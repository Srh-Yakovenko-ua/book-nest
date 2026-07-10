import "@testing-library/jest-dom/vitest";

import type { BookView } from "@app/shared";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { AddBooksToListDialog } from "./add-books-to-list-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToAdd: () => Response;
let booksResult: BookView[];

function addCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/lists") && (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function booksPage(items: BookView[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 24, totalCount: items.length };
}

function checkboxAt(index: number): HTMLElement {
  const checkbox = screen.getAllByRole("checkbox")[index];
  if (checkbox === undefined) throw new Error(`no checkbox at index ${index}`);
  return checkbox;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(listBookIds: string[] = [], onOpenChange = vi.fn()) {
  return renderWithProviders(
    <AddBooksToListDialog
      listBookIds={listBookIds}
      listId="list-1"
      onOpenChange={onOpenChange}
      open
    />,
  );
}

beforeEach(() => {
  respondToAdd = () => jsonResponse({ added: 1, bookCount: 1 });
  booksResult = [
    makeBookView({ id: "book-in", title: "Вже додана" }),
    makeBookView({ id: "book-free", title: "Вільна книга" }),
  ];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/lists") && method === "POST") return Promise.resolve(respondToAdd());
    if (url.includes("/api/books")) return Promise.resolve(jsonResponse(booksPage(booksResult)));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddBooksToListDialog", () => {
  it("marks books already in the list as unavailable", async () => {
    renderDialog(["book-in"]);

    expect(await screen.findByText("Вже додана")).toBeInTheDocument();
    expect(screen.getByText("Уже в списку")).toBeInTheDocument();
    expect(checkboxAt(0)).toBeDisabled();
  });

  it("keeps the submit action disabled until a book is selected", async () => {
    renderDialog();
    await screen.findByText("Вільна книга");

    expect(screen.getByRole("button", { name: "Додати до списку" })).toBeDisabled();

    await userEvent.click(checkboxAt(1));

    expect(screen.getByRole("button", { name: "Додати до списку" })).toBeEnabled();
    expect(screen.getByText("Вибрано книг: 1")).toBeInTheDocument();
  });

  it("adds the selected books and confirms with a toast", async () => {
    const onOpenChange = vi.fn();
    renderDialog([], onOpenChange);
    await screen.findByText("Вільна книга");

    await userEvent.click(checkboxAt(1));
    await userEvent.click(screen.getByRole("button", { name: "Додати до списку" }));

    await waitFor(() => expect(addCall()).toBeDefined());
    expect(String(addCall()?.[0])).toContain("/api/lists/list-1/books");
    expect(JSON.parse(String(addCall()?.[1].body))).toEqual({ bookIds: ["book-free"] });
    expect(toast.success).toHaveBeenCalledWith("1 книгу додано до списку");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an empty state when the library search returns nothing", async () => {
    booksResult = [];
    renderDialog();

    expect(await screen.findByText("Книг не знайдено")).toBeInTheDocument();
  });
});

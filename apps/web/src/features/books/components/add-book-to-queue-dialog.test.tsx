import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { AddBookToQueueDialog } from "./add-book-to-queue-dialog";
import { makeBookView } from "./book-details.fixtures";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const add = messages.readingQueue.add;
const position = messages.readingQueue.position;
const fetchMock = vi.fn();

let respondToAdd: () => Response;

function addRequestBody() {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/reading-queue") &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
  return JSON.parse(String(call?.[1].body));
}

function booksPage() {
  return {
    items: [
      makeBookView({ id: "book-available", isInReadingQueue: false, title: "Доступна книга" }),
      makeBookView({ id: "book-queued", isInReadingQueue: true, title: "Уже додана книга" }),
    ],
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: 2,
  };
}

function emptyQueue() {
  return { count: 0, items: [], totalPagesCount: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(queueLength = 3) {
  return renderWithProviders(
    <AddBookToQueueDialog onOpenChange={vi.fn()} open queueLength={queueLength} />,
  );
}

beforeEach(() => {
  respondToAdd = () => jsonResponse(emptyQueue());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/reading-queue") && method === "POST") {
      return Promise.resolve(respondToAdd());
    }
    if (url.includes("/api/books")) return Promise.resolve(jsonResponse(booksPage()));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddBookToQueueDialog", () => {
  it("disables books that are already in the queue", async () => {
    renderDialog();

    expect(await screen.findByRole("radio", { name: /Уже додана книга/ })).toBeDisabled();
    expect(screen.getByText(add.alreadyInQueue)).toBeInTheDocument();
  });

  it("reveals the placement selector only after a book is selected", async () => {
    renderDialog();
    await screen.findByRole("radio", { name: /Доступна книга/ });

    expect(screen.queryByText(position.legend)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Доступна книга/ }));

    expect(screen.getByText(position.legend)).toBeInTheDocument();
  });

  it("posts the selected book with the default end placement", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Доступна книга/ }));
    await userEvent.click(screen.getByRole("button", { name: add.submit }));

    await waitFor(() =>
      expect(addRequestBody()).toEqual({ bookId: "book-available", placement: "end" }),
    );
  });

  it("posts a specific position when chosen", async () => {
    renderDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Доступна книга/ }));
    await userEvent.click(screen.getByRole("radio", { name: position.specific }));
    await userEvent.clear(screen.getByLabelText(position.positionLabel));
    await userEvent.type(screen.getByLabelText(position.positionLabel), "2");
    await userEvent.click(screen.getByRole("button", { name: add.submit }));

    await waitFor(() =>
      expect(addRequestBody()).toEqual({
        bookId: "book-available",
        placement: "specific",
        position: 2,
      }),
    );
  });

  it("surfaces the duplicate message when the server rejects with a conflict", async () => {
    respondToAdd = () => jsonResponse({ message: "duplicate" }, 409);
    renderDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Доступна книга/ }));
    await userEvent.click(screen.getByRole("button", { name: add.submit }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(add.duplicateToast));
  });
});

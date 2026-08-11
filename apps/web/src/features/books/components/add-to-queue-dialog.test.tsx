import "@testing-library/jest-dom/vitest";
import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { AddToQueueDialog } from "./add-to-queue-dialog";
import { makeBookView } from "./book-details.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const add = messages.readingQueue.add;
const addDialog = messages.books.details.queue.addDialog;
const item = messages.readingQueue.item;
const fetchMock = vi.fn();

let resolveQueue: (response: Response) => void;

function deferQueue() {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    if (String(input).includes("/api/reading-queue")) {
      return new Promise<Response>((resolve) => {
        resolveQueue = resolve;
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function queueView(items: { book: BookView; position: number }[]) {
  return { count: items.length, items, totalCount: items.length, totalPagesCount: 0 };
}

function renderDialog(book: BookView, context: "detail" | "list" = "list") {
  return renderWithProviders(
    <AddToQueueDialog book={book} context={context} onOpenChange={vi.fn()} open />,
  );
}

function resolveQueueWith(items: { book: BookView; position: number }[]) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    if (String(input).includes("/api/reading-queue")) {
      return Promise.resolve(jsonResponse(queueView(items)));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

function withItems(book: BookView, position: number) {
  return [
    { book: makeBookView({ id: "other-a", title: "Інша книга A" }), position: 1 },
    { book, position },
  ];
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddToQueueDialog", () => {
  it("disables submitting until the queue count is known", async () => {
    deferQueue();
    const book = makeBookView({ id: "book-1", isInReadingQueue: false });
    renderDialog(book);

    expect(screen.getByRole("button", { name: add.submit })).toBeDisabled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      resolveQueue(
        jsonResponse(
          queueView([{ book: makeBookView({ id: "other", title: "Інша" }), position: 1 }]),
        ),
      );
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: add.submit })).not.toBeDisabled(),
    );
  });

  it("shows the book preview in the list context", async () => {
    const book = makeBookView({ id: "book-1", isInReadingQueue: false, title: "Книга у списку" });
    resolveQueueWith([{ book: makeBookView({ id: "other", title: "Інша" }), position: 1 }]);
    renderDialog(book, "list");

    expect(await screen.findByText("Книга у списку")).toBeInTheDocument();
  });

  it("omits the book preview in the detail context", async () => {
    const book = makeBookView({ id: "book-1", isInReadingQueue: false, title: "Книга деталей" });
    resolveQueueWith([{ book: makeBookView({ id: "other", title: "Інша" }), position: 1 }]);
    renderDialog(book, "detail");

    expect(await screen.findByText(/Зараз у черзі/)).toBeInTheDocument();
    expect(screen.queryByText("Книга деталей")).not.toBeInTheDocument();
  });

  it("shows the current queue size line", async () => {
    const book = makeBookView({ id: "book-1", isInReadingQueue: false });
    resolveQueueWith([{ book: makeBookView({ id: "other", title: "Інша" }), position: 1 }]);
    renderDialog(book, "detail");

    expect(await screen.findByText(/Зараз у черзі/)).toBeInTheDocument();
  });

  it("opens in move mode when the book is already queued", async () => {
    const book = makeBookView({ id: "book-1", isInReadingQueue: true, title: "Уже в черзі" });
    resolveQueueWith(withItems(book, 2));
    renderDialog(book, "detail");

    expect(await screen.findByText(addDialog.moveTitle)).toBeInTheDocument();
    expect(screen.getByText(/вже в черзі/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: item.remove })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: addDialog.move })).toBeInTheDocument();
  });
});

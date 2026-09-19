import "@testing-library/jest-dom/vitest";

import type { NoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookNote } from "../model/notes.fixtures";
import { BookNotesBlock } from "./book-notes-block";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const BOOK = makeBookView({
  authors: [{ id: "author-1", name: "Френк Герберт" }],
  id: "book-1",
  title: "Дюна",
});

const FAVORITE = "Улюблена нотатка";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToNotesList: () => Promise<Response>;

function calls(method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input) === path && String(init?.method ?? "GET").toUpperCase() === method,
  );
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function notesList(notes: NoteView[]): Promise<Response> {
  return Promise.resolve(jsonResponse({ notes, totalCount: notes.length }));
}

beforeEach(() => {
  respondToNotesList = () => notesList([makeBookNote()]);

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url === "/api/books/book-1/notes") return respondToNotesList();
    if (method === "PATCH" && url === "/api/notes/note-1") {
      const body = JSON.parse(String(init?.body)) as Partial<NoteView>;
      return Promise.resolve(jsonResponse(makeBookNote(body)));
    }
    if (method === "POST" && url === "/api/books/book-1/notes") {
      return Promise.resolve(jsonResponse(makeBookNote({ id: "note-2" })));
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookNotesBlock add note", () => {
  it("opens the note dialog with the current book already chosen", async () => {
    renderWithProviders(<BookNotesBlock book={BOOK} />);
    await screen.findByRole("button", { name: FAVORITE });

    await userEvent.click(screen.getByRole("button", { name: "Додати нотатку" }));

    const dialog = await screen.findByRole("dialog", { name: "Додати нотатку" });
    expect(within(dialog).getByRole("group", { name: "Книга" })).toHaveTextContent("Дюна");
    expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("textbox", { name: "Пошук книги за назвою або автором" }),
    ).not.toBeInTheDocument();
  });

  it("opens the same dialog from the empty state", async () => {
    respondToNotesList = () => notesList([]);
    renderWithProviders(<BookNotesBlock book={BOOK} />);

    await userEvent.click(await screen.findByRole("button", { name: "Додати першу нотатку" }));

    const dialog = await screen.findByRole("dialog", { name: "Додати нотатку" });
    expect(within(dialog).getByRole("group", { name: "Книга" })).toHaveTextContent("Дюна");
  });

  it("saves the new note against the current book", async () => {
    renderWithProviders(<BookNotesBlock book={BOOK} />);
    await screen.findByRole("button", { name: FAVORITE });
    await userEvent.click(screen.getByRole("button", { name: "Додати нотатку" }));

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Текст нотатки" }),
      "Нова думка про Арракіс.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Зберегти нотатку" }));

    await waitFor(() => expect(calls("POST", "/api/books/book-1/notes")).toHaveLength(1));
  });
});

describe("BookNotesBlock favorite toggle", () => {
  it("keeps the toggle disabled until the notes refetch completes", async () => {
    renderWithProviders(<BookNotesBlock book={BOOK} />);
    const toggle = await screen.findByRole("button", { name: FAVORITE });
    const refetch = deferredResponse();
    respondToNotesList = () => refetch.promise;

    await userEvent.click(toggle);

    await waitFor(() => expect(calls("GET", "/api/books/book-1/notes")).toHaveLength(2));
    expect(screen.getByRole("button", { name: FAVORITE })).toHaveAttribute("aria-disabled", "true");

    refetch.resolve(jsonResponse({ notes: [makeBookNote({ isFavorite: true })], totalCount: 1 }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: FAVORITE })).toHaveAttribute(
        "aria-disabled",
        "false",
      ),
    );
  });

  it("sends a single PATCH when the toggle is clicked again during the refetch", async () => {
    renderWithProviders(<BookNotesBlock book={BOOK} />);
    const toggle = await screen.findByRole("button", { name: FAVORITE });
    const refetch = deferredResponse();
    respondToNotesList = () => refetch.promise;
    await userEvent.click(toggle);
    await waitFor(() => expect(calls("GET", "/api/books/book-1/notes")).toHaveLength(2));

    await userEvent.click(screen.getByRole("button", { name: FAVORITE }));

    refetch.resolve(jsonResponse({ notes: [makeBookNote({ isFavorite: true })], totalCount: 1 }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: FAVORITE })).toHaveAttribute(
        "aria-disabled",
        "false",
      ),
    );
    expect(calls("PATCH", "/api/notes/note-1")).toHaveLength(1);
  });

  it("sends a single PATCH on a fast double click", async () => {
    renderWithProviders(<BookNotesBlock book={BOOK} />);
    const toggle = await screen.findByRole("button", { name: FAVORITE });
    const refetch = deferredResponse();
    respondToNotesList = () => refetch.promise;

    await userEvent.dblClick(toggle);

    refetch.resolve(jsonResponse({ notes: [makeBookNote({ isFavorite: true })], totalCount: 1 }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: FAVORITE })).toHaveAttribute(
        "aria-disabled",
        "false",
      ),
    );
    expect(calls("PATCH", "/api/notes/note-1")).toHaveLength(1);
  });

  it("shows the favorite as pressed once the PATCH succeeds", async () => {
    renderWithProviders(<BookNotesBlock book={BOOK} />);
    const toggle = await screen.findByRole("button", { name: FAVORITE });
    respondToNotesList = () => notesList([makeBookNote({ isFavorite: true })]);

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: FAVORITE })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });
});

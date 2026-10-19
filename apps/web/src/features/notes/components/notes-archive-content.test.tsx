import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver, renderWithProviders, screen, userEvent } from "@/test-utils";

import type { NotesArchiveListState } from "../model/notes-archive-list-state";

import { makeBookNote } from "../model/notes.fixtures";
import { useBookNotesEmptyCopy } from "../model/use-book-notes-empty-copy";
import { NotesArchiveContent } from "./notes-archive-content";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const viewport = mockIntersectionObserver();

const LOADED_NOTE = makeBookNote({ id: "note-1", text: "Завантажена нотатка." });
const NEXT_PAGE_NOTE = makeBookNote({ id: "note-2", text: "Нотатка з наступної сторінки." });

function readyState(
  overrides: Partial<Extract<NotesArchiveListState, { kind: "ready" }>> = {},
): NotesArchiveListState {
  return {
    isRefreshing: false,
    kind: "ready",
    nextPage: "none",
    notes: [LOADED_NOTE],
    ...overrides,
  };
}

function renderContent(state: NotesArchiveListState) {
  const handlers = {
    onAddNote: vi.fn(),
    onClearFilters: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
  };
  renderWithProviders(<NotesArchiveContent {...handlers} state={state} view="grid" />);
  return handlers;
}

describe("NotesArchiveContent", () => {
  it("shows placeholders without inventing notes while the first page loads", () => {
    renderContent({ kind: "loading" });

    expect(screen.getByLabelText("Завантажуємо нотатки...")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("marks every card with its note id so a scroll position can find it again", () => {
    renderContent(readyState({ notes: [LOADED_NOTE, NEXT_PAGE_NOTE] }));

    expect(
      screen.getAllByRole("listitem").map((item) => item.getAttribute("data-note-id")),
    ).toEqual([LOADED_NOTE.id, NEXT_PAGE_NOTE.id]);
  });

  it("invites the first note when the library is empty", async () => {
    const { onAddNote } = renderContent({ kind: "empty", reason: "library" });

    expect(screen.getByText("У вас ще немає нотаток.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Додати нотатку" }));

    expect(onAddNote).toHaveBeenCalledOnce();
  });

  it("offers to reset the filters when a search finds nothing", async () => {
    const { onClearFilters } = renderContent({ kind: "empty", reason: "search" });

    expect(screen.getByText("Нічого не знайдено.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Додати нотатку" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("offers to reset the filters when the filters leave nothing", async () => {
    const { onClearFilters } = renderContent({ kind: "empty", reason: "filters" });

    expect(screen.getByText("За цими фільтрами нотаток немає.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("retries the first page after it fails", async () => {
    const { onRetry } = renderContent({ kind: "error" });

    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити нотатки.");
    await userEvent.click(screen.getByRole("button", { name: "Оновити" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the loaded notes and retries only the next page when it fails", async () => {
    const { onLoadMore, onRetry } = renderContent(readyState({ nextPage: "error" }));

    expect(screen.getByText("Завантажена нотатка.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити наступні нотатки.");
    await userEvent.click(screen.getByRole("button", { name: "Повторити" }));

    expect(onLoadMore).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("loads the next page as the sentinel reaches the viewport", () => {
    const { onLoadMore } = renderContent(readyState({ nextPage: "idle" }));

    viewport.enterViewport();

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("announces the next page instead of asking for it again while it loads", () => {
    const { onLoadMore } = renderContent(readyState({ nextPage: "loading" }));

    viewport.enterViewport();

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Завантажуємо ще...")).toBeInTheDocument();
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("drops the sentinel once every note is shown", () => {
    renderContent(readyState());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("moves focus to the first newly loaded note once the last page arrives", () => {
    const handlers = {
      onAddNote: vi.fn(),
      onClearFilters: vi.fn(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
    };
    const { rerender } = renderWithProviders(
      <NotesArchiveContent {...handlers} state={readyState({ nextPage: "idle" })} view="grid" />,
    );

    viewport.enterViewport();
    rerender(
      <NotesArchiveContent
        {...handlers}
        state={readyState({ nextPage: "none", notes: [LOADED_NOTE, NEXT_PAGE_NOTE] })}
        view="grid"
      />,
    );

    const [, firstNewLink] = screen.getAllByRole("link", { name: "Дюна" });
    expect(firstNewLink).toHaveFocus();
    expect(handlers.onLoadMore).toHaveBeenCalledOnce();
  });

  it("moves focus to the first newly loaded note while more pages remain", () => {
    const handlers = {
      onAddNote: vi.fn(),
      onClearFilters: vi.fn(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
    };
    const { rerender } = renderWithProviders(
      <NotesArchiveContent {...handlers} state={readyState({ nextPage: "idle" })} view="list" />,
    );

    viewport.enterViewport();
    rerender(
      <NotesArchiveContent {...handlers} state={readyState({ nextPage: "loading" })} view="list" />,
    );
    rerender(
      <NotesArchiveContent
        {...handlers}
        state={readyState({ nextPage: "idle", notes: [LOADED_NOTE, NEXT_PAGE_NOTE] })}
        view="list"
      />,
    );

    const [, firstNewLink] = screen.getAllByRole("link", { name: "Дюна" });
    expect(firstNewLink).toHaveFocus();
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-busy", "true");
  });
});

describe("NotesArchiveContent in the book notes tab", () => {
  function BookNotesContent(props: Omit<ComponentProps<typeof NotesArchiveContent>, "emptyCopy">) {
    return <NotesArchiveContent {...props} emptyCopy={useBookNotesEmptyCopy()} />;
  }

  function bookHandlers() {
    return {
      onAddNote: vi.fn(),
      onClearFilters: vi.fn(),
      onClearSearch: vi.fn(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
    };
  }

  it("stacks the embedded cards in one column without repeating the book", () => {
    renderWithProviders(
      <BookNotesContent
        {...bookHandlers()}
        state={readyState({ notes: [LOADED_NOTE, NEXT_PAGE_NOTE] })}
        view="embedded"
      />,
    );

    const list = screen.getByRole("list");
    expect(list).toHaveClass("grid-cols-1");
    expect(list).not.toHaveClass("lg:grid-cols-2");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Дюна" })).not.toBeInTheDocument();
  });

  it("leaves focus in place when the next page arrives and focus is opted out", () => {
    const handlers = bookHandlers();
    const { rerender } = renderWithProviders(
      <BookNotesContent
        {...handlers}
        loadMoreFocus="none"
        state={readyState({ nextPage: "idle" })}
        view="embedded"
      />,
    );

    viewport.enterViewport();
    rerender(
      <BookNotesContent
        {...handlers}
        loadMoreFocus="none"
        state={readyState({ nextPage: "idle", notes: [LOADED_NOTE, NEXT_PAGE_NOTE] })}
        view="embedded"
      />,
    );

    expect(handlers.onLoadMore).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(document.body).toHaveFocus();
  });

  it("keeps focus off the retry button when a background page fails and focus is opted out", () => {
    renderWithProviders(
      <BookNotesContent
        {...bookHandlers()}
        loadMoreFocus="none"
        state={readyState({ nextPage: "error" })}
        view="embedded"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити наступні нотатки.");
    expect(screen.getByRole("button", { name: "Повторити" })).not.toHaveFocus();
  });

  it("moves focus to the first new card after a keyboard retry even when focus is opted out", async () => {
    const handlers = bookHandlers();
    const { rerender } = renderWithProviders(
      <BookNotesContent
        {...handlers}
        loadMoreFocus="none"
        state={readyState({ nextPage: "error" })}
        view="embedded"
      />,
    );

    screen.getByRole("button", { name: "Повторити" }).focus();
    await userEvent.keyboard("{Enter}");
    rerender(
      <BookNotesContent
        {...handlers}
        loadMoreFocus="none"
        state={readyState({ nextPage: "loading" })}
        view="embedded"
      />,
    );
    rerender(
      <BookNotesContent
        {...handlers}
        loadMoreFocus="none"
        state={readyState({ nextPage: "none", notes: [LOADED_NOTE, NEXT_PAGE_NOTE] })}
        view="embedded"
      />,
    );

    expect(handlers.onLoadMore).toHaveBeenCalledOnce();
    const [, firstNewItem] = screen.getAllByRole("listitem");
    expect(firstNewItem?.contains(document.activeElement)).toBe(true);
  });

  it("still focuses the first new embedded card unless focus is opted out", () => {
    const handlers = bookHandlers();
    const { rerender } = renderWithProviders(
      <BookNotesContent {...handlers} state={readyState({ nextPage: "idle" })} view="embedded" />,
    );

    viewport.enterViewport();
    rerender(
      <BookNotesContent
        {...handlers}
        state={readyState({ nextPage: "idle", notes: [LOADED_NOTE, NEXT_PAGE_NOTE] })}
        view="embedded"
      />,
    );

    const [, firstNewItem] = screen.getAllByRole("listitem");
    expect(firstNewItem?.contains(document.activeElement)).toBe(true);
  });

  it("invites the first note for this book", async () => {
    const handlers = bookHandlers();
    renderWithProviders(
      <BookNotesContent
        {...handlers}
        state={{ kind: "empty", reason: "library" }}
        view="embedded"
      />,
    );

    expect(screen.getByText("У цієї книги ще немає нотаток.")).toBeInTheDocument();
    expect(screen.queryByText("У вас ще немає нотаток.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Додати нотатку" }));

    expect(handlers.onAddNote).toHaveBeenCalledOnce();
  });

  it("clears only the search when the search finds nothing", async () => {
    const handlers = bookHandlers();
    renderWithProviders(
      <BookNotesContent
        {...handlers}
        state={{ kind: "empty", reason: "search" }}
        view="embedded"
      />,
    );

    expect(screen.getByText("Нічого не знайдено.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Очистити пошук" }));

    expect(handlers.onClearSearch).toHaveBeenCalledOnce();
    expect(handlers.onClearFilters).not.toHaveBeenCalled();
  });

  it("resets the filters when the filters leave nothing", async () => {
    const handlers = bookHandlers();
    renderWithProviders(
      <BookNotesContent
        {...handlers}
        state={{ kind: "empty", reason: "filters" }}
        view="embedded"
      />,
    );

    expect(screen.getByText("За цими фільтрами нотаток немає.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    expect(handlers.onClearFilters).toHaveBeenCalledOnce();
    expect(handlers.onClearSearch).not.toHaveBeenCalled();
  });
});

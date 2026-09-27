import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { mockIntersectionObserver, renderWithProviders, screen, userEvent } from "@/test-utils";

import type { NotesArchiveListState } from "../model/notes-archive-list-state";

import { makeBookNote } from "../model/notes.fixtures";
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

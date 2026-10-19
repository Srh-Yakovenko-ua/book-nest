import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { NotesArchiveFacets } from "../api/use-notes-facets";
import type { BookNotesTabState } from "../model/book-notes-tab-query";

import { BookNotesToolbar } from "./book-notes-toolbar";

const FACETS: NotesArchiveFacets = {
  categories: [
    { category: "plot", count: 4 },
    { category: "question", count: 2 },
  ],
  customCategories: [{ count: 1, value: "Лор" }],
  options: { author: [], book: [], genre: [], series: [] },
  quickCounts: { all: 7, favorite: 2, no_spoiler: 5, pinned: 3, with_spoiler: 2 },
};

const DEFAULT_STATE: BookNotesTabState = {
  noteCategory: [],
  noteCustomCategory: [],
  noteFilter: "all",
  noteQ: "",
  noteSort: "page",
};

type ToolbarOptions = Partial<
  Pick<ComponentProps<typeof BookNotesToolbar>, "facets" | "facetsPending">
> & { state?: BookNotesTabState };

function renderToolbar({ state = DEFAULT_STATE, ...props }: ToolbarOptions = {}) {
  const query = {
    clearSearch: vi.fn(),
    setCategories: vi.fn(),
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
    state,
  };
  const onAddNote = vi.fn();
  renderWithProviders(
    <BookNotesToolbar
      facets={FACETS}
      facetsPending={false}
      onAddNote={onAddNote}
      query={query}
      {...props}
    />,
  );
  return { onAddNote, query };
}

describe("BookNotesToolbar", () => {
  it("keeps the toolbar compact, without the archive-only controls", () => {
    renderToolbar();

    expect(screen.getByRole("textbox", { name: "Пошук у нотатках цієї книги" })).toBeVisible();
    expect(screen.queryByRole("radiogroup", { name: "Вигляд" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Фільтри" })).not.toBeInTheDocument();
    expect(screen.queryByText("Книги")).not.toBeInTheDocument();
    expect(screen.queryByText("Автори")).not.toBeInTheDocument();
  });

  it("asks for a new note", async () => {
    const { onAddNote } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Додати нотатку" }));

    expect(onAddNote).toHaveBeenCalledOnce();
  });

  it("shows the five quick filters with their server counts", async () => {
    const { query } = renderToolbar();
    const chips = within(screen.getByRole("radiogroup", { name: "Швидкі фільтри" }));

    expect(chips.getAllByRole("radio")).toHaveLength(5);
    expect(chips.getByRole("radio", { name: "Закріплені 3" })).toBeInTheDocument();
    await userEvent.click(chips.getByRole("radio", { name: "Закріплені 3" }));

    expect(query.setFilter).toHaveBeenCalledWith("pinned");
  });

  it("marks the chip counts as pending while the facets load", () => {
    renderToolbar({ facets: undefined, facetsPending: true });

    const chips = screen.getAllByRole("radio");
    expect(chips).toHaveLength(5);
    for (const chip of chips) {
      expect(chip.querySelector("[data-slot='chip-count-pending']")).toBeInTheDocument();
    }
  });

  it("offers exactly the five book sorts", async () => {
    const { query } = renderToolbar();

    await userEvent.click(screen.getByRole("combobox", { name: "Сортування" }));
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "За сторінкою",
      "Нові спочатку",
      "Старі спочатку",
      "Нещодавно оновлені",
      "Спочатку закріплені",
    ]);
    await userEvent.click(screen.getByRole("option", { name: "Нові спочатку" }));

    expect(query.setSort).toHaveBeenCalledWith("newest");
  });

  it("selects standard and custom categories from the facets", async () => {
    const { query } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: /Категорії/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Сюжет/ }));

    expect(query.setCategories).toHaveBeenLastCalledWith({
      category: ["plot"],
      customCategory: [],
    });
    expect(screen.getByRole("option", { name: /Інше: Лор/ })).toBeInTheDocument();
  });

  it("clears the categories without touching the other criteria", async () => {
    const { query } = renderToolbar({
      state: {
        ...DEFAULT_STATE,
        noteCategory: ["plot"],
        noteCustomCategory: ["Лор"],
        noteFilter: "pinned",
        noteQ: "дюна",
        noteSort: "newest",
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Прибрати Сюжет" }));

    expect(query.setCategories).toHaveBeenCalledWith({ category: [], customCategory: ["Лор"] });
    expect(query.setSearch).not.toHaveBeenCalled();
    expect(query.setFilter).not.toHaveBeenCalled();
    expect(query.setSort).not.toHaveBeenCalled();
  });

  it("clears the search through the search reset alone", async () => {
    const { query } = renderToolbar({ state: { ...DEFAULT_STATE, noteQ: "дюна" } });

    await userEvent.click(screen.getByRole("button", { name: "Очистити пошук" }));

    expect(query.clearSearch).toHaveBeenCalledOnce();
    expect(query.setSearch).not.toHaveBeenCalled();
  });
});

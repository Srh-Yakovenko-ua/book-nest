import "@testing-library/jest-dom/vitest";

import type { NoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { addMinutes, addSeconds, parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { makeBookNote, makeSeriesNote, NOTE_FIXTURE } from "../model/notes.fixtures";
import { NoteFullViewDialog } from "./note-full-view-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchMock = vi.fn();

function openFullView(note: NoteView) {
  renderWithProviders(
    <NoteFullViewDialog note={note} onOpenChange={vi.fn()} open triggerRef={{ current: null }} />,
  );
  return screen.getByRole("dialog");
}

function updatedAfter(shift: (created: Date) => Date): string {
  return shift(parseISO(NOTE_FIXTURE.createdAt)).toISOString();
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error("Full View must not hit the network"));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("NoteFullViewDialog book header", () => {
  it("titles the dialog with the book name", () => {
    expect(openFullView(makeBookNote())).toHaveAccessibleName("Дюна");
  });

  it("links the title to the book page", () => {
    const dialog = openFullView(makeBookNote());

    expect(within(dialog).getByRole("link", { name: "Дюна" })).toHaveAttribute(
      "href",
      "/books/book-1",
    );
  });

  it("links the cover to the book page without a second screen-reader link", () => {
    const dialog = openFullView(makeBookNote());
    const links = within(dialog).getAllByRole("link", { hidden: true });

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/books/book-1",
      "/books/book-1",
    ]);
    expect(within(dialog).getAllByRole("link")).toHaveLength(1);
  });

  it("describes the dialog with the book author", () => {
    expect(openFullView(makeBookNote())).toHaveAccessibleDescription("Френк Герберт");
  });
});

describe("NoteFullViewDialog series header", () => {
  it("links the series name to the series page", () => {
    const dialog = openFullView(makeSeriesNote());

    expect(dialog).toHaveAccessibleName("Хроніки Дюни");
    expect(within(dialog).getByRole("link", { name: "Хроніки Дюни" })).toHaveAttribute(
      "href",
      "/series/series-1",
    );
  });

  it("shows the series authors and its book count", () => {
    const dialog = openFullView(makeSeriesNote());

    expect(within(dialog).getByText("Френк Герберт")).toBeInTheDocument();
    expect(within(dialog).getByText("6 книг")).toBeInTheDocument();
  });
});

describe("NoteFullViewDialog fallback title", () => {
  it("falls back to a generic title when the book is gone", () => {
    expect(openFullView(makeBookNote({ book: null }))).toHaveAccessibleName("Нотатка");
  });
});

describe("NoteFullViewDialog content", () => {
  it("shows the whole note text inside the text region", () => {
    const dialog = openFullView(makeBookNote());

    expect(
      within(within(dialog).getByRole("region", { name: "Текст нотатки" })).getByText(
        NOTE_FIXTURE.text,
      ),
    ).toBeInTheDocument();
  });

  it("shows a spoiler note text openly with a spoiler badge", () => {
    const dialog = openFullView(makeBookNote({ isSpoiler: true }));

    expect(within(dialog).getByText(NOTE_FIXTURE.text)).toBeInTheDocument();
    expect(within(dialog).getByText("Спойлер")).toBeInTheDocument();
    expect(within(dialog).queryByText("Ця нотатка містить спойлер")).not.toBeInTheDocument();
  });

  it("shows the category", () => {
    const dialog = openFullView(makeBookNote({ category: "worldbuilding" }));

    expect(within(dialog).getByText("Світобудова")).toBeInTheDocument();
  });

  it("shows the custom category name for a note filed under other", () => {
    const dialog = openFullView(makeBookNote({ category: "other", customCategory: "Пророцтва" }));

    expect(within(dialog).getByText("Пророцтва")).toBeInTheDocument();
  });

  it("offers no mutation controls, only closing", () => {
    const dialog = openFullView(makeBookNote({ isSpoiler: true }));

    expect(
      within(dialog)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Close"]);
  });
});

describe("NoteFullViewDialog dates", () => {
  it("shows the creation date", () => {
    const dialog = openFullView(makeBookNote());

    expect(
      within(dialog).getByText(/^Створено 5 січня 2026 р\. о \d{2}:\d{2}$/),
    ).toBeInTheDocument();
  });

  it("hides the update date when the note was never edited", () => {
    const dialog = openFullView(makeBookNote());

    expect(within(dialog).queryByText(/^Оновлено/)).not.toBeInTheDocument();
  });

  it("hides the update date for an edit less than a minute after creation", () => {
    const dialog = openFullView(
      makeBookNote({ updatedAt: updatedAfter((created) => addSeconds(created, 59)) }),
    );

    expect(within(dialog).queryByText(/^Оновлено/)).not.toBeInTheDocument();
  });

  it("shows the update date once the edit is at least a minute after creation", () => {
    const dialog = openFullView(
      makeBookNote({ updatedAt: updatedAfter((created) => addMinutes(created, 1)) }),
    );

    expect(
      within(dialog).getByText(/^Оновлено 5 січня 2026 р\. о \d{2}:\d{2}$/),
    ).toBeInTheDocument();
  });
});

describe("NoteFullViewDialog book location", () => {
  it("labels the chapter and the page separately", () => {
    const dialog = openFullView(makeBookNote({ chapter: "Розділ III", page: 87 }));

    expect(
      within(dialog)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["Розділ", "Сторінка"]);
    expect(
      within(dialog)
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["Розділ III", "87"]);
  });

  it("shows only the page row when the note has no chapter", () => {
    const dialog = openFullView(makeBookNote({ chapter: null, page: 87 }));

    expect(
      within(dialog)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["Сторінка"]);
  });

  it("renders no location when the note has neither chapter nor page", () => {
    const dialog = openFullView(makeBookNote({ chapter: null, page: null }));

    expect(within(dialog).queryByRole("term")).not.toBeInTheDocument();
  });
});

describe("NoteFullViewDialog series saved location", () => {
  it("shows the legacy chapter and page under the saved-location label", () => {
    const dialog = openFullView(makeSeriesNote({ chapter: "Том 2", page: 12 }));

    expect(within(dialog).getByText("Збережене місце")).toBeInTheDocument();
    expect(within(dialog).getByText("Том 2 · стор. 12")).toBeInTheDocument();
  });

  it("omits the saved location when the series note has no legacy values", () => {
    const dialog = openFullView(makeSeriesNote({ chapter: null, page: null }));

    expect(within(dialog).queryByText("Збережене місце")).not.toBeInTheDocument();
  });

  it("does not use the book chapter and page labels for a series note", () => {
    const dialog = openFullView(makeSeriesNote({ chapter: "Том 2", page: 12 }));

    expect(within(dialog).queryByRole("term")).not.toBeInTheDocument();
  });
});

import "@testing-library/jest-dom/vitest";

import type {
  ReadingStatus,
  SeriesBeforeNextBookNote,
  SeriesBeforeNextBookView,
} from "@app/shared";
import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeBookNote } from "../model/notes.fixtures";
import { SeriesBeforeContinuationBlock } from "./series-before-continuation-block";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function beforeNextBook(
  overrides: Partial<SeriesBeforeNextBookView> = {},
  readingStatus: ReadingStatus = "not_started",
): SeriesBeforeNextBookView {
  return {
    continuation: {
      authors: [{ id: "author-1", name: "Френк Герберт" }],
      cover: null,
      id: "book-3",
      ownershipStatus: "none",
      progress: null,
      readingStatus,
      reason: "available",
      seriesPosition: 3,
      title: "Діти Дюни",
    },
    notes: [recapNote("note-1", { id: "book-1", seriesPosition: 1, title: "Дюна" })],
    previewLimit: 5,
    series: { id: "series-1", knownBooksCount: 6, title: "Хроніки Дюни", totalBooks: 6 },
    totalCount: 1,
    ...overrides,
  };
}

function block() {
  return within(screen.getByRole("region", { name: "Перед продовженням серії" }));
}

function firstRecapItem(): HTMLElement {
  const [item] = recapItems();
  if (item === undefined) throw new Error("the recap holds no note");
  return item;
}

function recapItems() {
  return within(screen.getByRole("group", { name: "Що варто згадати" })).getAllByRole("listitem");
}

function recapNote(
  id: string,
  sourceBook: SeriesBeforeNextBookNote["sourceBook"],
  overrides: Partial<SeriesBeforeNextBookNote> = {},
): SeriesBeforeNextBookNote {
  return {
    ...makeBookNote({
      book: { author: "Френк Герберт", cover: null, id: sourceBook.id, title: sourceBook.title },
      id,
      text: `Нотатка ${id}`,
    }),
    sourceBook,
    ...overrides,
  };
}

function renderBlock(view: SeriesBeforeNextBookView, onOpenNote = vi.fn()) {
  renderWithProviders(
    <SeriesBeforeContinuationBlock beforeNextBook={view} onOpenNote={onOpenNote} />,
  );
  return { onOpenNote };
}

describe("SeriesBeforeContinuationBlock continuation copy", () => {
  it.each([
    {
      badge: "Наступна книга",
      cta: "Перейти до книги",
      readingStatus: "not_started",
      subtitle: "Що варто згадати перед «Діти Дюни»",
    },
    {
      badge: "Зараз читаєте",
      cta: "Продовжити читати",
      readingStatus: "reading",
      subtitle: "Що варто згадати під час читання «Діти Дюни»",
    },
    {
      badge: "Зараз перечитуєте",
      cta: "Продовжити перечитування",
      readingStatus: "rereading",
      subtitle: "Що варто згадати під час перечитування «Діти Дюни»",
    },
    {
      badge: "Читання призупинено",
      cta: "Повернутися до книги",
      readingStatus: "paused",
      subtitle: "Що варто згадати перед поверненням до «Діти Дюни»",
    },
  ] as const)(
    "speaks to a $readingStatus continuation",
    ({ badge, cta, readingStatus, subtitle }) => {
      renderBlock(beforeNextBook({}, readingStatus));

      expect(block().getByText(subtitle)).toBeInTheDocument();
      expect(block().getByText(badge)).toBeInTheDocument();
      expect(block().getByRole("link", { name: cta })).toHaveAttribute("href", "/books/book-3");
    },
  );

  it("places the continuation inside the series by its resolved position", () => {
    renderBlock(beforeNextBook());

    expect(block().getByText("Хроніки Дюни · Книга 3")).toBeInTheDocument();
  });
});

describe("SeriesBeforeContinuationBlock recap notes", () => {
  it("labels a note with the book position and title when the book has a position", () => {
    renderBlock(beforeNextBook());

    expect(within(firstRecapItem()).getByText("Книга 1 · Дюна")).toBeInTheDocument();
  });

  it("labels a note with the bare book title when the book has no position", () => {
    renderBlock(
      beforeNextBook({
        notes: [recapNote("note-1", { id: "book-9", seriesPosition: null, title: "Легенди Дюни" })],
      }),
    );

    expect(within(firstRecapItem()).getByText("Легенди Дюни")).toBeInTheDocument();
    expect(screen.queryByText(/Книга \d+ · Легенди Дюни/)).not.toBeInTheDocument();
  });

  it("keeps the notes in the order the server ranked them", () => {
    renderBlock(
      beforeNextBook({
        notes: [
          recapNote("note-c", { id: "book-2", seriesPosition: 2, title: "Месія Дюни" }),
          recapNote("note-a", { id: "book-1", seriesPosition: 1, title: "Дюна" }),
          recapNote("note-b", { id: "book-0", seriesPosition: 0, title: "Пролог" }),
        ],
        totalCount: 3,
      }),
    );

    expect(recapItems().map((item) => within(item).getByText(/^Нотатка /).textContent)).toEqual([
      "Нотатка note-c",
      "Нотатка note-a",
      "Нотатка note-b",
    ]);
  });

  it("hides the text of a spoiler note behind the compact gate", () => {
    renderBlock(
      beforeNextBook({
        notes: [
          recapNote(
            "note-1",
            { id: "book-1", seriesPosition: 1, title: "Дюна" },
            { isSpoiler: true, text: "Пол стає імператором." },
          ),
        ],
      }),
    );

    expect(screen.queryByText("Пол стає імператором.")).not.toBeInTheDocument();
    expect(block().getByText("Ця нотатка містить спойлер")).toBeInTheDocument();
  });

  it("opens the full view of a spoiler note from its gate", async () => {
    const spoiler = recapNote(
      "note-1",
      { id: "book-1", seriesPosition: 1, title: "Дюна" },
      { isSpoiler: true, text: "Пол стає імператором." },
    );
    const { onOpenNote } = renderBlock(beforeNextBook({ notes: [spoiler] }));

    await userEvent.click(block().getByRole("button", { name: "Показати нотатку" }));

    expect(onOpenNote).toHaveBeenCalledWith(spoiler, expect.any(HTMLButtonElement));
  });
});

describe("SeriesBeforeContinuationBlock footer", () => {
  it("links to every note of the series when the preview holds fewer than the total", () => {
    renderBlock(beforeNextBook({ totalCount: 7 }));

    expect(block().getByRole("link", { name: "Переглянути всі нотатки серії" })).toHaveAttribute(
      "href",
      "/notes/series?series=series-1",
    );
  });

  it("drops the footer when the preview already holds every note", () => {
    renderBlock(beforeNextBook({ totalCount: 1 }));

    expect(
      block().queryByRole("link", { name: "Переглянути всі нотатки серії" }),
    ).not.toBeInTheDocument();
  });
});

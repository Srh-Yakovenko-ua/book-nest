import "@testing-library/jest-dom/vitest";

import type { SeriesBookView } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeSeriesBookView, makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesBooksTab } from "./series-books-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderTab({
  books,
  canAddBook = true,
  nextBookId,
  onAddBook = vi.fn(),
  totalBooks = 5,
}: {
  books: SeriesBookView[];
  canAddBook?: boolean;
  nextBookId?: string;
  onAddBook?: (partNumber: null | number) => void;
  totalBooks?: null | number;
}) {
  return renderWithProviders(
    <SeriesBooksTab
      canAddBook={canAddBook}
      details={makeSeriesDetailsView({
        books,
        booksInSeries: books.length,
        nextBook:
          nextBookId === undefined ? null : { id: nextBookId, partNumber: null, title: "Наступна" },
        totalBooks,
      })}
      onAddBook={onAddBook}
    />,
  );
}

function rowAt(index: number): HTMLElement {
  const row = rows()[index];
  if (row === undefined) throw new Error(`no series book row at index ${index}`);
  return row;
}

function rows(): HTMLElement[] {
  return screen.getAllByRole("article");
}

function slotOf(index: number): HTMLElement {
  const slot = rowAt(index).closest("li");
  if (slot === null) throw new Error(`no series slot wrapping book row ${index}`);
  return slot;
}

describe("SeriesBooksTab", () => {
  it("orders books by part number ascending and puts unnumbered books last", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "c", partNumber: null, title: "Без номера" }),
        makeSeriesBookView({ id: "b", partNumber: 4, title: "Четверта" }),
        makeSeriesBookView({ id: "a", partNumber: 1, title: "Перша" }),
      ],
    });

    const titles = rows().map((row) => within(row).getByRole("heading").textContent);

    expect(titles).toEqual(["Перша", "Четверта", "Без номера"]);
  });

  it("warns above the list when part numbers repeat, without hiding the books", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, title: "Перша" }),
        makeSeriesBookView({ id: "b", partNumber: 1, title: "Теж перша" }),
      ],
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "У серії є книги з однаковими номерами частин: 1",
    );
    expect(rows()).toHaveLength(2);
  });

  it("stays quiet about duplicates when the numbering only has gaps", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1 }),
        makeSeriesBookView({ id: "b", partNumber: 3 }),
        makeSeriesBookView({ id: "c", partNumber: 4 }),
      ],
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  it("shows the edition lines with format, pages and year", () => {
    renderTab({
      books: [
        makeSeriesBookView({
          formats: ["paper"],
          id: "a",
          pagesCount: 384,
          partNumber: 1,
          publicationYear: 2023,
        }),
      ],
    });

    const row = within(rowAt(0));

    expect(row.getByText("Паперова")).toBeInTheDocument();
    expect(row.getByText("384 стор.")).toBeInTheDocument();
    expect(row.getByText("2023")).toBeInTheDocument();
  });

  it("marks the next book in order", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, readingStatus: "finished" }),
        makeSeriesBookView({ id: "b", partNumber: 2, readingStatus: "not_started" }),
      ],
      nextBookId: "b",
    });

    expect(within(slotOf(0)).queryByText("Наступна за порядком")).not.toBeInTheDocument();
    expect(within(slotOf(1)).getByText("Наступна за порядком")).toBeInTheDocument();
  });

  it("marks only the books that sit in the reading queue", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "a", isInReadingQueue: true, partNumber: 1 }),
        makeSeriesBookView({ id: "b", isInReadingQueue: false, partNumber: 2 }),
      ],
    });

    expect(within(rowAt(0)).getByText("У черзі")).toBeInTheDocument();
    expect(within(rowAt(1)).queryByText("У черзі")).not.toBeInTheDocument();
  });

  it("shows real progress for a book being read and none when pages are unknown", () => {
    renderTab({
      books: [
        makeSeriesBookView({
          currentPage: 180,
          id: "a",
          pagesCount: 640,
          partNumber: 1,
          readingStatus: "reading",
        }),
        makeSeriesBookView({
          currentPage: 10,
          id: "b",
          pagesCount: null,
          partNumber: 2,
          readingStatus: "reading",
        }),
      ],
    });

    expect(within(rowAt(0)).getByText("28% · 180 з 640 стор.")).toBeInTheDocument();
    expect(within(rowAt(0)).getByRole("progressbar")).toBeInTheDocument();
    expect(within(rowAt(1)).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a static pause line without a progress bar", () => {
    renderTab({
      books: [
        makeSeriesBookView({
          currentPage: 192,
          id: "a",
          pagesCount: 416,
          partNumber: 1,
          readingStatus: "paused",
        }),
      ],
    });

    expect(within(rowAt(0)).getByText("Призупинено · 192 з 416 стор.")).toBeInTheDocument();
    expect(within(rowAt(0)).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("gives dnf its own badge and no progress", () => {
    renderTab({
      books: [
        makeSeriesBookView({
          currentPage: 100,
          id: "a",
          pagesCount: 300,
          partNumber: 1,
          readingStatus: "dnf",
        }),
      ],
    });

    expect(within(rowAt(0)).getByText("Покинуто")).toBeInTheDocument();
    expect(within(rowAt(0)).getByText("Не дочитано")).toBeInTheDocument();
    expect(within(rowAt(0)).queryByText("Прочитано")).not.toBeInTheDocument();
    expect(within(rowAt(0)).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("hides authors that repeat the series authors and shows them when they differ", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1 }),
        makeSeriesBookView({
          authors: [{ id: "author-2", name: "Запрошений автор" }],
          id: "b",
          partNumber: 2,
        }),
      ],
    });

    expect(within(rowAt(0)).queryByText("Ребекка Яррос")).not.toBeInTheDocument();
    expect(within(rowAt(1)).getByText("Запрошений автор")).toBeInTheDocument();
  });

  it("omits the series line, the queue marker and a zero rating", () => {
    renderTab({ books: [makeSeriesBookView({ id: "a", partNumber: 1, rating: 0 })] });

    const row = rowAt(0);

    expect(within(row).queryByText("Емпіреї")).not.toBeInTheDocument();
    expect(within(row).queryByText("У черзі")).not.toBeInTheDocument();
    expect(within(row).queryByText("0/10")).not.toBeInTheDocument();
  });

  it("keeps the whole card linking to the book and labels its actions", () => {
    renderTab({ books: [makeSeriesBookView({ id: "book-a", partNumber: 1, title: "Перша" })] });

    const row = rowAt(0);

    expect(within(row).getByRole("link", { name: "Перша" })).toHaveAttribute(
      "href",
      "/books/book-a",
    );
    expect(within(row).getByRole("button", { name: "Додати до улюблених" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Дії з книгою" })).toBeInTheDocument();
  });

  it("renders every position the series still expects as a placeholder", () => {
    renderTab({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, title: "Перша" }),
        makeSeriesBookView({ id: "b", partNumber: 2, title: "Друга" }),
      ],
      totalBooks: 3,
    });

    expect(rows()).toHaveLength(2);
    expect(screen.getByText("Книга 3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Додати книгу 3 до бібліотеки" }),
    ).toBeInTheDocument();
  });

  it("asks to add a book at the position of the placeholder that was clicked", async () => {
    const onAddBook = vi.fn();
    renderTab({
      books: [makeSeriesBookView({ id: "a", partNumber: 1 })],
      onAddBook,
      totalBooks: 3,
    });

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу 3 до бібліотеки" }));

    expect(onAddBook).toHaveBeenCalledWith(3);
  });

  it("leaves the position open when the plain add button is used", async () => {
    const onAddBook = vi.fn();
    renderTab({
      books: [makeSeriesBookView({ id: "a", partNumber: 1 })],
      onAddBook,
      totalBooks: 3,
    });

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу в цю серію" }));

    expect(onAddBook).toHaveBeenCalledWith(null);
  });

  it("keeps a single add affordance when the series length is unknown", () => {
    renderTab({
      books: [makeSeriesBookView({ id: "a", partNumber: 1 })],
      totalBooks: null,
    });

    expect(screen.queryByText(/^Книга \d+$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати книгу в цю серію" })).toBeInTheDocument();
    expect(screen.queryByText("ще 1 не додано")).not.toBeInTheDocument();
  });
});

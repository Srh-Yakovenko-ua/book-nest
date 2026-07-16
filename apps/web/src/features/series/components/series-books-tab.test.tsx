import "@testing-library/jest-dom/vitest";

import type { SeriesBookView } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { makeSeriesBookView, makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesBooksTab } from "./series-books-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderTab(books: SeriesBookView[], nextBookId?: string) {
  return renderWithProviders(
    <SeriesBooksTab
      details={makeSeriesDetailsView({
        books,
        booksInSeries: books.length,
        nextBook:
          nextBookId === undefined ? null : { id: nextBookId, partNumber: null, title: "Наступна" },
      })}
      onAddBook={vi.fn()}
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

describe("SeriesBooksTab", () => {
  it("orders books by part number ascending and puts unnumbered books last", () => {
    renderTab([
      makeSeriesBookView({ id: "c", partNumber: null, title: "Без номера" }),
      makeSeriesBookView({ id: "b", partNumber: 4, title: "Четверта" }),
      makeSeriesBookView({ id: "a", partNumber: 1, title: "Перша" }),
    ]);

    const titles = rows().map((row) => within(row).getByRole("heading").textContent);

    expect(titles).toEqual(["Перша", "Четверта", "Без номера"]);
  });

  it("warns above the list when part numbers repeat, without hiding the books", () => {
    renderTab([
      makeSeriesBookView({ id: "a", partNumber: 1, title: "Перша" }),
      makeSeriesBookView({ id: "b", partNumber: 1, title: "Теж перша" }),
    ]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "У серії є книги з однаковими номерами частин: 1",
    );
    expect(rows()).toHaveLength(2);
  });

  it("stays quiet about duplicates when the numbering only has gaps", () => {
    renderTab([
      makeSeriesBookView({ id: "a", partNumber: 1 }),
      makeSeriesBookView({ id: "b", partNumber: 3 }),
      makeSeriesBookView({ id: "c", partNumber: 4 }),
    ]);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  it("notes the missing part number on an unnumbered book", () => {
    renderTab([makeSeriesBookView({ id: "a", partNumber: null })]);

    expect(within(rowAt(0)).getByText("Номер частини не вказано")).toBeInTheDocument();
  });

  it("marks the next book in order", () => {
    renderTab(
      [
        makeSeriesBookView({ id: "a", partNumber: 1, readingStatus: "finished" }),
        makeSeriesBookView({ id: "b", partNumber: 2, readingStatus: "not_started" }),
      ],
      "b",
    );

    expect(within(rowAt(0)).queryByText("Наступна за порядком")).not.toBeInTheDocument();
    expect(within(rowAt(1)).getByText("Наступна за порядком")).toBeInTheDocument();
  });

  it("shows real progress for a book being read and none when pages are unknown", () => {
    renderTab([
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
    ]);

    expect(within(rowAt(0)).getByText("стор. 180 з 640 · 28%")).toBeInTheDocument();
    expect(within(rowAt(1)).queryByText(/стор\./)).not.toBeInTheDocument();
  });

  it("gives dnf its own badge and no progress", () => {
    renderTab([
      makeSeriesBookView({
        currentPage: 100,
        id: "a",
        pagesCount: 300,
        partNumber: 1,
        readingStatus: "dnf",
      }),
    ]);

    expect(within(rowAt(0)).getByText("Покинуто")).toBeInTheDocument();
    expect(within(rowAt(0)).queryByText("Прочитано")).not.toBeInTheDocument();
    expect(within(rowAt(0)).queryByText(/стор\./)).not.toBeInTheDocument();
  });

  it("hides authors that repeat the series authors and shows them when they differ", () => {
    renderTab([
      makeSeriesBookView({ id: "a", partNumber: 1 }),
      makeSeriesBookView({
        authors: [{ id: "author-2", name: "Запрошений автор" }],
        id: "b",
        partNumber: 2,
      }),
    ]);

    expect(within(rowAt(0)).queryByText("Ребекка Яррос")).not.toBeInTheDocument();
    expect(within(rowAt(1)).getByText("Запрошений автор")).toBeInTheDocument();
  });

  it("omits the series line, the queue marker and a zero rating", () => {
    renderTab([makeSeriesBookView({ id: "a", partNumber: 1, rating: 0 })]);

    const row = rowAt(0);

    expect(within(row).queryByText("Емпіреї")).not.toBeInTheDocument();
    expect(within(row).queryByText("В черзі")).not.toBeInTheDocument();
    expect(within(row).queryByText("0/10")).not.toBeInTheDocument();
  });

  it("keeps the whole card linking to the book and labels its actions", () => {
    renderTab([makeSeriesBookView({ id: "book-a", partNumber: 1, title: "Перша" })]);

    const row = rowAt(0);

    expect(within(row).getByRole("link", { name: "Перша" })).toHaveAttribute(
      "href",
      "/books/book-a",
    );
    expect(within(row).getByRole("button", { name: "Додати до улюблених" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Дії з книгою" })).toBeInTheDocument();
  });
});

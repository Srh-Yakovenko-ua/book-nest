import "@testing-library/jest-dom/vitest";

import type { MediaView, SeriesBookView, SeriesDetailsView, SeriesStatus } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { makeSeriesBookView, makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesDetailsHero } from "./series-details-hero";

function makeCover(id: string): MediaView {
  return {
    contentType: "image/jpeg",
    createdAt: "2026-01-01T00:00:00.000Z",
    height: 800,
    id: `media-${id}`,
    kind: "book_cover",
    name: null,
    sizeBytes: 1024,
    urls: {
      card: `https://cdn.example/${id}-card.jpg`,
      full: `https://cdn.example/${id}-full.jpg`,
      thumb: `https://cdn.example/${id}-thumb.jpg`,
    },
    width: 600,
  };
}

function makeFinishedBooks(count: number): SeriesBookView[] {
  return Array.from({ length: count }, (_, index) =>
    makeSeriesBookView({
      id: `finished-${index + 1}`,
      partNumber: index + 1,
      readingStatus: "finished",
      title: `Книга ${index + 1}`,
    }),
  );
}

function renderHero(books: SeriesBookView[], totalBooks: null | number = 5) {
  return renderHeroDetails({ books, booksInSeries: books.length, totalBooks });
}

function renderHeroDetails(overrides: Partial<SeriesDetailsView>) {
  return renderWithProviders(
    <SeriesDetailsHero
      canAddBook
      details={makeSeriesDetailsView(overrides)}
      onAddBook={vi.fn()}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
}

const statusCases: [SeriesStatus, string][] = [
  ["completed", "Завершена"],
  ["ongoing", "Ще виходить"],
  ["unknown", "Невідомо"],
];

describe("SeriesDetailsHero", () => {
  it("renders the cover fan and moves the count onto it when books have covers", () => {
    renderHero([
      makeSeriesBookView({ cover: makeCover("a"), id: "a", partNumber: 1, title: "Перша" }),
      makeSeriesBookView({ cover: makeCover("b"), id: "b", partNumber: 2, title: "Друга" }),
    ]);

    const fan = screen.getByRole("img", { name: "Обкладинки книг серії Емпіреї, 2 книги" });

    expect(fan).toBeInTheDocument();
    expect(within(fan).getByText("2 з 5 додано")).toBeInTheDocument();
    expect(screen.getAllByText("2 з 5 додано")).toHaveLength(1);
  });

  it("caps the fan at three layers while the counter keeps the real series count", () => {
    const books = [1, 2, 3, 4, 5].map((part) =>
      makeSeriesBookView({
        cover: makeCover(`c${part}`),
        id: `c${part}`,
        partNumber: part,
        title: `Книга ${part}`,
      }),
    );
    renderHero(books);

    const fan = screen.getByRole("img", { name: "Обкладинки книг серії Емпіреї, 5 книг" });

    expect(within(fan).getAllByAltText(/Книга/)).toHaveLength(3);
    expect(within(fan).getByText("5 з 5 додано")).toBeInTheDocument();
  });

  it("keeps the count chip in the text column when no book has a cover", () => {
    renderHero([makeSeriesBookView({ id: "no-cover", partNumber: 1 })]);

    expect(screen.queryByRole("img", { name: /Обкладинки книг/ })).not.toBeInTheDocument();
    expect(screen.getByText("1 з 5 додано")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Емпіреї" })).toBeInTheDocument();
  });

  it.each(statusCases)("renders the %s status badge above the title", (status, label) => {
    renderHeroDetails({ status });

    const badge = screen.getByText(label);
    const title = screen.getByRole("heading", { level: 1, name: "Емпіреї" });

    expect(badge).toBeInTheDocument();
    expect(Boolean(badge.compareDocumentPosition(title) & badge.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
  });

  it("shows the fully-read badge when every book of a finished series is read", () => {
    renderHeroDetails({
      books: makeFinishedBooks(3),
      booksInSeries: 3,
      finishedInSeries: 3,
      totalBooks: 3,
    });

    expect(screen.getByText("Серію прочитано")).toBeInTheDocument();
  });

  it("hides the fully-read badge while some books are unread", () => {
    renderHeroDetails({ booksInSeries: 3, finishedInSeries: 1, totalBooks: 5 });

    expect(screen.queryByText("Серію прочитано")).not.toBeInTheDocument();
  });

  it("shows the fully-read badge when totalBooks is unknown and every added book is read", () => {
    renderHeroDetails({
      books: makeFinishedBooks(3),
      booksInSeries: 3,
      finishedInSeries: 3,
      totalBooks: null,
    });

    expect(screen.getByText("Серію прочитано")).toBeInTheDocument();
  });

  it("keeps the fully-read badge next to the status badge above the title", () => {
    renderHeroDetails({
      books: makeFinishedBooks(3),
      booksInSeries: 3,
      finishedInSeries: 3,
      status: "completed",
      totalBooks: 3,
    });

    const statusBadge = screen.getByText("Завершена");
    const readBadge = screen.getByText("Серію прочитано");
    const title = screen.getByRole("heading", { level: 1, name: "Емпіреї" });

    expect(statusBadge.parentElement).toBe(readBadge.parentElement);
    expect(
      Boolean(readBadge.compareDocumentPosition(title) & readBadge.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });
});

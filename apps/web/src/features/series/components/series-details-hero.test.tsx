import "@testing-library/jest-dom/vitest";

import type { MediaView, SeriesBookView } from "@app/shared";

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

function renderHero(books: SeriesBookView[], totalBooks: null | number = 5) {
  return renderWithProviders(
    <SeriesDetailsHero
      details={makeSeriesDetailsView({ books, booksInSeries: books.length, totalBooks })}
      onAddBook={vi.fn()}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
}

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
});

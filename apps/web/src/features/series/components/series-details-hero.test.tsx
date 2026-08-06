import "@testing-library/jest-dom/vitest";

import type {
  GenreView,
  MediaView,
  SeriesBookView,
  SeriesDetailsView,
  SeriesStatus,
} from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { makeSeriesBookView, makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesDetailsHero } from "./series-details-hero";

vi.mock("@/i18n/navigation", () => ({
  getPathname: () => "/",
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  redirect: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeGenres(entries: { key: string; name: string }[]): GenreView[] {
  return entries.map((entry) => ({
    groupKey: "fiction",
    groupName: "Художня література",
    id: `genre-${entry.key}`,
    isDefault: false,
    key: entry.key,
    name: entry.name,
  }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/api/genres")) {
      return Promise.resolve(
        jsonResponse(
          makeGenres([
            { key: "fantasy", name: "Фентезі" },
            { key: "romance", name: "Романтика" },
            { key: "adventure", name: "Пригоди" },
          ]),
        ),
      );
    }
    return Promise.resolve(jsonResponse({}));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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
      onReadFullDescription={vi.fn()}
    />,
  );
}

const statusCases: [SeriesStatus, string][] = [
  ["completed", "Завершена"],
  ["ongoing", "Ще виходить"],
  ["unknown", "Невідомо"],
];

describe("SeriesDetailsHero", () => {
  it("renders the cover fan and the total book count in the metadata row", () => {
    renderHero([
      makeSeriesBookView({ cover: makeCover("a"), id: "a", partNumber: 1, title: "Перша" }),
      makeSeriesBookView({ cover: makeCover("b"), id: "b", partNumber: 2, title: "Друга" }),
    ]);

    const fan = screen.getByRole("img", { name: "Обкладинки книг серії Емпіреї, 2 книги" });

    expect(fan).toBeInTheDocument();
    expect(within(fan).getByText("2 з 5 додано")).toBeInTheDocument();
    expect(screen.getAllByText("2 з 5 додано")).toHaveLength(1);
    expect(screen.getByText("5 книг")).toBeInTheDocument();
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

  it("shows the book counter and no cover fan when the books lack covers", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ id: "no-cover", partNumber: 1 })],
      booksInSeries: 1,
      publishers: [],
      status: "unknown",
      totalBooks: 4,
    });

    expect(screen.queryByRole("img", { name: /Обкладинки книг/ })).not.toBeInTheDocument();
    expect(screen.getByText("4 книги")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Емпіреї" })).toBeInTheDocument();
  });

  it("uses the declared total for the counter over the added book count", () => {
    renderHeroDetails({
      books: [],
      booksInSeries: 2,
      publishers: [],
      status: "unknown",
      totalBooks: 4,
    });

    expect(screen.getByText("4 книги")).toBeInTheDocument();
    expect(screen.queryByText("2 книги")).not.toBeInTheDocument();
  });

  it("falls back to the added book count when the total is unknown", () => {
    renderHeroDetails({
      books: [],
      booksInSeries: 2,
      publishers: [],
      status: "unknown",
      totalBooks: null,
    });

    expect(screen.getByText("2 книги")).toBeInTheDocument();
  });

  it("hides the book counter when the series has no books", () => {
    renderHeroDetails({
      books: [],
      booksInSeries: 0,
      publishers: [],
      status: "unknown",
      totalBooks: 0,
    });

    expect(screen.queryByText("0 книг")).not.toBeInTheDocument();
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

    const statusLabel = screen.getByText("Завершена");
    const readLabel = screen.getByText("Серію прочитано");
    const statusBadge = statusLabel.closest('[data-slot="status-badge"]');
    const readBadge = readLabel.closest('[data-slot="status-badge"]');
    const title = screen.getByRole("heading", { level: 1, name: "Емпіреї" });

    expect(statusBadge).not.toBeNull();
    expect(readBadge).not.toBeNull();
    expect(statusBadge?.parentElement).toBe(readBadge?.parentElement);
    expect(
      Boolean(readLabel.compareDocumentPosition(title) & readLabel.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it("renders the declared series genres and ignores the book genres", async () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ genres: ["fantasy", "romance"], id: "book-1" })],
      genres: ["adventure"],
    });

    expect(await screen.findByText("Пригоди")).toBeInTheDocument();
    expect(screen.queryByText("Фентезі")).not.toBeInTheDocument();
    expect(screen.queryByText("Романтика")).not.toBeInTheDocument();
  });

  it("falls back to the deduplicated union of book genres when the series declares none", async () => {
    renderHeroDetails({
      books: [
        makeSeriesBookView({ genres: ["fantasy", "romance"], id: "book-1" }),
        makeSeriesBookView({ genres: ["romance", "adventure"], id: "book-2" }),
      ],
      genres: [],
    });

    expect(await screen.findByText("Фентезі")).toBeInTheDocument();
    expect(screen.getByText("Романтика")).toBeInTheDocument();
    expect(screen.getByText("Пригоди")).toBeInTheDocument();
  });

  it("renders no genre chips when neither the series nor its books have genres", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ genres: [], id: "book-1" })],
      genres: [],
    });

    expect(screen.queryByText("Фентезі")).not.toBeInTheDocument();
  });

  it("caps the genre chips at six and collapses the rest into an overflow chip", () => {
    renderHeroDetails({
      books: [],
      genres: ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"],
    });

    expect(screen.getByText("ще 2")).toBeInTheDocument();
    expect(screen.queryByText("g7")).not.toBeInTheDocument();
  });

  it("shows the publication-year range of a completed series", () => {
    renderHeroDetails({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 }),
        makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: 2024 }),
      ],
      status: "completed",
    });

    expect(screen.getByText("2021–2024")).toBeInTheDocument();
  });

  it("shows a single publication year when a completed series shares it across its ends", () => {
    renderHeroDetails({
      books: [
        makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2024 }),
        makeSeriesBookView({ id: "b", partNumber: 2, publicationYear: 2024 }),
      ],
      status: "completed",
    });

    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("shows an open-ended year for an ongoing series", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 })],
      status: "ongoing",
    });

    expect(screen.getByText("З 2021 року")).toBeInTheDocument();
  });

  it("renders no year metadata for a series with an unknown status", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 })],
      publishers: [],
      status: "unknown",
    });

    expect(screen.queryByText("2021")).not.toBeInTheDocument();
    expect(screen.queryByText("З 2021 року")).not.toBeInTheDocument();
  });

  it("shows a single publisher name", () => {
    renderHeroDetails({ publishers: [{ id: "p1", name: "Vivat" }] });

    expect(screen.getByText("Vivat")).toBeInTheDocument();
  });

  it("joins several publisher names with commas", () => {
    renderHeroDetails({
      publishers: [
        { id: "p1", name: "Vivat" },
        { id: "p2", name: "КСД" },
        { id: "p3", name: "Ranok" },
      ],
    });

    expect(screen.getByText("Vivat, КСД, Ranok")).toBeInTheDocument();
  });

  it("caps publishers at three and collapses the rest into an overflow label", () => {
    renderHeroDetails({
      publishers: [
        { id: "p1", name: "Vivat" },
        { id: "p2", name: "КСД" },
        { id: "p3", name: "Ranok" },
        { id: "p4", name: "А-ба-ба-га-ла-ма-га" },
        { id: "p5", name: "Наш формат" },
      ],
    });

    expect(screen.getByText("Vivat, КСД, Ranok ще 2")).toBeInTheDocument();
  });

  it("renders no publisher metadata when the series has no publishers", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 })],
      publishers: [],
      status: "completed",
    });

    expect(screen.queryByText("Vivat")).not.toBeInTheDocument();
  });

  it("orders the metadata as books, then years, then publishers with a separator between each", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 })],
      booksInSeries: 4,
      publishers: [{ id: "p1", name: "Vivat" }],
      status: "ongoing",
      totalBooks: 4,
    });

    const count = screen.getByText("4 книги");
    const year = screen.getByText("З 2021 року");
    const publisher = screen.getByText("Vivat");

    expect(screen.getAllByText("·")).toHaveLength(2);
    expect(Boolean(count.compareDocumentPosition(year) & count.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
    expect(
      Boolean(year.compareDocumentPosition(publisher) & year.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it("omits the separator when only publishers are present", () => {
    renderHeroDetails({
      books: [],
      booksInSeries: 0,
      publishers: [{ id: "p1", name: "Vivat" }],
      status: "unknown",
      totalBooks: 0,
    });

    expect(screen.getByText("Vivat")).toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });

  it("omits the separator when only years are present", () => {
    renderHeroDetails({
      books: [makeSeriesBookView({ id: "a", partNumber: 1, publicationYear: 2021 })],
      booksInSeries: 0,
      publishers: [],
      status: "ongoing",
      totalBooks: 0,
    });

    expect(screen.getByText("З 2021 року")).toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });
});

import type { BookView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { BooksRepository, BookWithRelations } from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { DedicationsService } from "./dedications.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function makeView(overrides: {
  authors?: string[];
  genres?: string[];
  id: string;
  isFavoriteDedication?: boolean;
  readingStatus?: BookView["readingStatus"];
}): BookView {
  return {
    authors: (overrides.authors ?? []).map((name, index) => ({
      id: `${overrides.id}-${index}`,
      name,
    })),
    genres: overrides.genres ?? [],
    id: overrides.id,
    isFavoriteDedication: overrides.isFavoriteDedication ?? false,
    readingStatus: overrides.readingStatus ?? "not_started",
  } as unknown as BookView;
}

function setup(views: BookView[]) {
  const rows = views.map((view) => ({ id: view.id }) as unknown as BookWithRelations);
  const listDedicationBooks = vi.fn().mockResolvedValue(rows);
  const booksRepository = { listDedicationBooks } as unknown as BooksRepository;
  const viewByRowId = new Map(views.map((view) => [view.id, view]));
  const viewOf = vi.fn(
    (row: BookWithRelations) => viewByRowId.get(row.id) ?? makeView({ id: row.id }),
  );
  const bookViewAssembler = { viewOf } as unknown as BookViewAssembler;
  const service = new DedicationsService(booksRepository, bookViewAssembler);

  return { listDedicationBooks, service, viewOf };
}

describe("DedicationsService.getDedications", () => {
  it("assembles a book view per row and returns them", async () => {
    const views = [
      makeView({ authors: ["Frank Herbert"], genres: ["memoir"], id: "book-a" }),
      makeView({ authors: ["Isaac Asimov"], genres: ["history"], id: "book-b" }),
    ];
    const { listDedicationBooks, service, viewOf } = setup(views);

    const result = await service.getDedications({ userId: USER_ID });

    expect(listDedicationBooks).toHaveBeenCalledWith({ userId: USER_ID });
    expect(viewOf).toHaveBeenCalledTimes(2);
    expect(result.books.map((book) => book.id)).toEqual(["book-a", "book-b"]);
  });

  it("computes the summary from the assembled views", async () => {
    const views = [
      makeView({
        authors: ["Frank Herbert"],
        genres: ["memoir", "history"],
        id: "book-a",
        readingStatus: "finished",
      }),
      makeView({
        authors: ["Frank Herbert"],
        genres: ["memoir"],
        id: "book-b",
        isFavoriteDedication: true,
        readingStatus: "reading",
      }),
    ];
    const { service } = setup(views);

    const result = await service.getDedications({ userId: USER_ID });

    expect(result.summary).toEqual({
      favoriteCount: 1,
      finishedCount: 1,
      topAuthor: { count: 2, name: "Frank Herbert" },
      topGenre: { count: 2, genre: "memoir" },
      totalCount: 2,
      unfinishedCount: 1,
    });
  });

  it("returns an empty result for a user without dedications", async () => {
    const { service } = setup([]);

    const result = await service.getDedications({ userId: USER_ID });

    expect(result).toEqual({
      books: [],
      summary: {
        favoriteCount: 0,
        finishedCount: 0,
        topAuthor: null,
        topGenre: null,
        totalCount: 0,
        unfinishedCount: 0,
      },
    });
  });
});

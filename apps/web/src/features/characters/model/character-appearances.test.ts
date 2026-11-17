import type { CharacterAppearanceBook, Nullable } from "@app/shared";

import { CHARACTER_CATALOG_BOOKS_PREVIEW_MAX, compareCharacterBooks } from "@app/shared";
import { describe, expect, it } from "vitest";

import { sortAppearances } from "./character-appearances";
import { makeBookCharacterView, makeCharacterAppearanceBook } from "./characters.fixtures";

type SeriesRef = { id: string; name: string };

const SERIES = {
  dune: { id: "series-dune", name: "Дюна" },
  game: { id: "series-game", name: "Гра" },
  grisha: { id: "series-grisha", name: "Ґрішаверс" },
  iliad: { id: "series-iliad", name: "Іліада" },
  iriy: { id: "series-iriy", name: "Ирій" },
  witcherA: { id: "series-a", name: "Відьмак" },
  witcherB: { id: "series-B", name: "Відьмак" },
} as const satisfies Record<string, SeriesRef>;

const SHORT_I_TITLE = {
  composed: "Йорданія",
  decomposed: "Йорданія",
} as const;

function idsByComparator(books: readonly CharacterAppearanceBook[]): string[] {
  return [...books].sort(compareCharacterBooks).map((book) => book.id);
}

function idsInCanonicalOrder(books: readonly CharacterAppearanceBook[]): string[] {
  const appearances = books.map((book) =>
    makeBookCharacterView({ book, bookId: book.id, id: `appearance-${book.id}` }),
  );
  return sortAppearances(appearances).map((appearance) => appearance.book.id);
}

function inSeries(
  id: string,
  title: string,
  series: SeriesRef,
  partNumber: Nullable<number>,
): CharacterAppearanceBook {
  return makeCharacterAppearanceBook({ id, series: { ...series, partNumber }, title });
}

function standalone(id: string, title: string): CharacterAppearanceBook {
  return makeCharacterAppearanceBook({ id, series: null, title });
}

const ORDER_CASES = [
  {
    books: [
      standalone("solo-yar", "Яр"),
      inSeries("game-1", "Престол", SERIES.game, 1),
      standalone("solo-alisa", "Аліса"),
    ],
    expected: ["game-1", "solo-alisa", "solo-yar"],
    name: "puts series books first and standalone books last, by title",
  },
  {
    books: [
      inSeries("dune-1", "Пісок", SERIES.dune, 1),
      inSeries("iliad-1", "Троя", SERIES.iliad, 1),
      inSeries("grisha-1", "Тінь", SERIES.grisha, 1),
      inSeries("iriy-1", "Вирій", SERIES.iriy, 1),
      inSeries("game-1", "Престол", SERIES.game, 1),
    ],
    expected: ["game-1", "grisha-1", "dune-1", "iriy-1", "iliad-1"],
    name: "orders series by the Ukrainian alphabet rather than by code points",
  },
  {
    books: [
      standalone("solo-mist", "Mist"),
      standalone("solo-alisa", "Аліса"),
      standalone("solo-apple", "apple"),
      standalone("solo-yar", "Яр"),
    ],
    expected: ["solo-alisa", "solo-yar", "solo-apple", "solo-mist"],
    name: "puts Cyrillic titles ahead of Latin ones",
  },
  {
    books: [
      standalone("solo-yar", "Яр"),
      standalone("solo-vovk", "вовк"),
      standalone("solo-elves-upper", "Ельфи"),
      standalone("solo-elves-lower", "ельфи"),
    ],
    expected: ["solo-vovk", "solo-elves-lower", "solo-elves-upper", "solo-yar"],
    name: "orders by letter before case and puts the lowercase title first on a tie",
  },
  {
    books: [
      standalone("solo-modifier", "Сімʼя"),
      standalone("solo-simka", "Сімка"),
      standalone("solo-typed", "Сім'я"),
    ],
    expected: ["solo-typed", "solo-simka", "solo-modifier"],
    name: "sorts the typed apostrophe as punctuation and the modifier apostrophe after the letters",
  },
  {
    books: [
      inSeries("a-1", "Останнє бажання", SERIES.witcherA, 1),
      inSeries("B-2", "Час презирства", SERIES.witcherB, 2),
      inSeries("a-2", "Меч призначення", SERIES.witcherA, 2),
      inSeries("B-1", "Кров ельфів", SERIES.witcherB, 1),
    ],
    expected: ["B-1", "B-2", "a-1", "a-2"],
    name: "keeps two series that share a name apart, ordered by series id in code units",
  },
  {
    books: [
      inSeries("dune-2-alisa", "Аліса", SERIES.dune, 2),
      inSeries("dune-1-sezon", "Сезон гроз", SERIES.dune, 1),
      inSeries("dune-1-vidmak", "Відьмак", SERIES.dune, 1),
    ],
    expected: ["dune-1-vidmak", "dune-1-sezon", "dune-2-alisa"],
    name: "orders a series by part and breaks a duplicate part by title",
  },
  {
    books: [
      inSeries("dune-none", "Аліса", SERIES.dune, null),
      inSeries("dune-10", "Березень", SERIES.dune, 10),
      inSeries("dune-9", "Вересень", SERIES.dune, 9),
    ],
    expected: ["dune-9", "dune-10", "dune-none"],
    name: "compares parts as numbers and puts a book without a part last",
  },
  {
    books: [
      inSeries("book-b", "Дюна", SERIES.dune, 1),
      inSeries("book-C", "Дюна", SERIES.dune, 1),
      inSeries("book-a", "Дюна", SERIES.dune, 1),
    ],
    expected: ["book-C", "book-a", "book-b"],
    name: "breaks a tie on series, part and title by book id in code units",
  },
  {
    books: [standalone("book-b", "Хроніки"), standalone("book-a", "Хроніки")],
    expected: ["book-a", "book-b"],
    name: "breaks a tie on a standalone title by book id",
  },
  {
    books: [
      standalone("book-1", SHORT_I_TITLE.composed),
      standalone("book-2", SHORT_I_TITLE.decomposed),
    ],
    expected: ["book-2", "book-1"],
    name: "falls back to code units before the id when the collator calls two titles equal",
  },
];

const PREVIEW_CANDIDATES = [
  ...Array.from({ length: 10 }, (_unused, index) =>
    standalone(`solo-${index + 1}`, `Аліса ${index + 1}`),
  ),
  ...Array.from({ length: 6 }, (_unused, index) =>
    inSeries(`dune-${index + 1}`, `Дюна ${index + 1}`, SERIES.dune, index + 1),
  ),
  inSeries("grisha-none", "Король шрамів", SERIES.grisha, null),
  inSeries("grisha-3", "Руїна і піднесення", SERIES.grisha, 3),
  inSeries("grisha-2-siege", "Облога і буря", SERIES.grisha, 2),
  inSeries("grisha-1", "Тінь і кістка", SERIES.grisha, 1),
  inSeries("grisha-2-crows", "Ворони", SERIES.grisha, 2),
];

describe("sortAppearances", () => {
  it.each(ORDER_CASES)("$name", ({ books, expected }) => {
    expect(idsInCanonicalOrder(books)).toEqual(expected);
    expect(idsInCanonicalOrder([...books].reverse())).toEqual(expected);
  });

  it("starts the sorted list of 21 books with the three a catalog preview shows", () => {
    const preview = ["grisha-1", "grisha-2-crows", "grisha-2-siege"];

    expect(PREVIEW_CANDIDATES).toHaveLength(21);
    expect(
      idsInCanonicalOrder(PREVIEW_CANDIDATES).slice(0, CHARACTER_CATALOG_BOOKS_PREVIEW_MAX),
    ).toEqual(preview);
    expect(
      idsInCanonicalOrder([...PREVIEW_CANDIDATES].reverse()).slice(
        0,
        CHARACTER_CATALOG_BOOKS_PREVIEW_MAX,
      ),
    ).toEqual(preview);
  });
});

describe("compareCharacterBooks", () => {
  it.each(ORDER_CASES)("$name", ({ books, expected }) => {
    expect(idsByComparator(books)).toEqual(expected);
    expect(idsByComparator([...books].reverse())).toEqual(expected);
  });
});

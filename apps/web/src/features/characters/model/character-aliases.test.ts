import { describe, expect, it } from "vitest";

import {
  ALIAS_DEFAULT_TYPE,
  emptyAliasRow,
  findAliasConflicts,
  toAliasPayload,
  toAliasRows,
} from "./character-aliases";
import { makeCharacterDetails } from "./characters.fixtures";

const character = makeCharacterDetails({
  aliases: [
    {
      bookId: null,
      id: "a-1",
      isSpoiler: false,
      name: "Білий Вовк",
      position: 0,
      type: "nickname",
    },
    {
      bookId: "book-1",
      id: "a-2",
      isSpoiler: true,
      name: "Ґвинблейдд",
      position: 0,
      type: "other",
    },
    { bookId: "book-2", id: "a-3", isSpoiler: false, name: "Різник", position: 0, type: "other" },
  ],
  name: "Ґеральт",
});

describe("toAliasRows", () => {
  it("keeps only the aliases of the asked scope", () => {
    expect(toAliasRows({ bookId: null, character }).map((row) => row.name)).toEqual(["Білий Вовк"]);
    expect(toAliasRows({ bookId: "book-1", character }).map((row) => row.name)).toEqual([
      "Ґвинблейдд",
    ]);
  });
});

describe("emptyAliasRow", () => {
  it("uses the generic type rather than the shared nickname default", () => {
    expect(emptyAliasRow().type).toBe(ALIAS_DEFAULT_TYPE);
    expect(emptyAliasRow().type).not.toBe("nickname");
  });
});

describe("toAliasPayload", () => {
  it("drops blank rows, trims the rest and numbers them in order", () => {
    expect(
      toAliasPayload([
        { isSpoiler: false, name: "  Білий Вовк  ", type: "nickname" },
        { isSpoiler: false, name: "   ", type: "other" },
        { isSpoiler: true, name: "Різник", type: "other" },
      ]),
    ).toEqual([
      { isSpoiler: false, name: "Білий Вовк", position: 0, type: "nickname" },
      { isSpoiler: true, name: "Різник", position: 1, type: "other" },
    ]);
  });
});

describe("findAliasConflicts", () => {
  it("compares case-insensitively and ignoring surrounding space", () => {
    const { duplicateIndexes } = findAliasConflicts({
      aliases: [
        { isSpoiler: false, name: "Білий Вовк", type: "other" },
        { isSpoiler: false, name: "  білий вовк ", type: "other" },
      ],
      reservedName: null,
    });

    expect(duplicateIndexes).toEqual([1]);
  });

  it("rejects an alias equal to the reserved name", () => {
    const { reservedIndexes } = findAliasConflicts({
      aliases: [{ isSpoiler: false, name: " ґеральт ", type: "other" }],
      reservedName: "Ґеральт",
    });

    expect(reservedIndexes).toEqual([0]);
  });

  it("ignores blank rows", () => {
    expect(
      findAliasConflicts({
        aliases: [
          { isSpoiler: false, name: "  ", type: "other" },
          { isSpoiler: false, name: "", type: "other" },
        ],
        reservedName: "Ґеральт",
      }),
    ).toEqual({ duplicateIndexes: [], reservedIndexes: [] });
  });
});

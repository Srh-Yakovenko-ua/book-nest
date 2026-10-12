import { describe, expect, it } from "vitest";

import type { CharacterAliasRow } from "./character-aliases";

import {
  ALIAS_DEFAULT_TYPE,
  emptyAliasRow,
  findAliasConflicts,
  findAliasDraftConflict,
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
  it("treats the same name of the same type as a duplicate, case-insensitively and ignoring extra spaces", () => {
    const { duplicateIndexes } = findAliasConflicts({
      aliases: [
        { isSpoiler: false, name: "Білий Вовк", type: "nickname" },
        { isSpoiler: false, name: "  білий   вовк ", type: "nickname" },
      ],
      reservedName: null,
    });

    expect(duplicateIndexes).toEqual([1]);
  });

  it("allows the same name under a different type, as the API does", () => {
    const { duplicateIndexes } = findAliasConflicts({
      aliases: [
        { isSpoiler: false, name: "Білий Вовк", type: "nickname" },
        { isSpoiler: false, name: "Білий Вовк", type: "title" },
      ],
      reservedName: null,
    });

    expect(duplicateIndexes).toEqual([]);
  });

  it("allows several different names of one type", () => {
    const { duplicateIndexes } = findAliasConflicts({
      aliases: [
        { isSpoiler: false, name: "Білий Вовк", type: "nickname" },
        { isSpoiler: false, name: "Різник", type: "nickname" },
      ],
      reservedName: null,
    });

    expect(duplicateIndexes).toEqual([]);
  });

  it("rejects an alias equal to the reserved name whatever its type", () => {
    const { reservedIndexes } = findAliasConflicts({
      aliases: [
        { isSpoiler: false, name: " ґеральт ", type: "other" },
        { isSpoiler: false, name: "Ґеральт", type: "true_name" },
      ],
      reservedName: "Ґеральт",
    });

    expect(reservedIndexes).toEqual([0, 1]);
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

describe("findAliasDraftConflict", () => {
  const aliases: CharacterAliasRow[] = [
    { isSpoiler: false, name: "Білий Вовк", type: "nickname" },
    { isSpoiler: false, name: "Різник", type: "other" },
  ];

  it("flags a new name that repeats an existing one of the same type", () => {
    expect(
      findAliasDraftConflict({
        aliases,
        draft: { isSpoiler: true, name: "білий вовк", type: "nickname" },
        editingIndex: null,
        reservedName: "Ґеральт",
      }),
    ).toBe("duplicate");
  });

  it("accepts a new name that repeats an existing one under another type", () => {
    expect(
      findAliasDraftConflict({
        aliases,
        draft: { isSpoiler: false, name: "Білий Вовк", type: "title" },
        editingIndex: null,
        reservedName: "Ґеральт",
      }),
    ).toBeNull();
  });

  it("flags a name equal to the reserved name", () => {
    expect(
      findAliasDraftConflict({
        aliases,
        draft: { isSpoiler: false, name: "  ҐЕРАЛЬТ ", type: "other" },
        editingIndex: null,
        reservedName: "Ґеральт",
      }),
    ).toBe("reserved");
  });

  it("ignores the row being edited, so saving it unchanged is not a duplicate", () => {
    expect(
      findAliasDraftConflict({
        aliases,
        draft: { isSpoiler: true, name: "Білий Вовк", type: "nickname" },
        editingIndex: 0,
        reservedName: "Ґеральт",
      }),
    ).toBeNull();
  });

  it("still flags an edit that collides with another row", () => {
    expect(
      findAliasDraftConflict({
        aliases,
        draft: { isSpoiler: false, name: "Різник", type: "other" },
        editingIndex: 0,
        reservedName: "Ґеральт",
      }),
    ).toBe("duplicate");
  });

  it("reports nothing for a blank draft", () => {
    expect(
      findAliasDraftConflict({
        aliases,
        draft: { isSpoiler: false, name: "   ", type: "other" },
        editingIndex: null,
        reservedName: "Ґеральт",
      }),
    ).toBeNull();
  });
});

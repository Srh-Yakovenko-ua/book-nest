import type { CharacterRevealFieldKey, Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import { selectVisibleAliases } from "./alias-groups.js";

type TestAlias = { bookId: Nullable<string>; isSpoiler: boolean; name: string };

const CONTEXT_BOOK_ID = "book-dune";
const SIBLING_BOOK_ID = "book-messiah";

const aliases: TestAlias[] = [
  { bookId: null, isSpoiler: false, name: "Usul" },
  { bookId: null, isSpoiler: true, name: "Kwisatz Haderach" },
  { bookId: CONTEXT_BOOK_ID, isSpoiler: false, name: "Paul-Muad'Dib" },
  { bookId: CONTEXT_BOOK_ID, isSpoiler: true, name: "Lisan al-Gaib" },
  { bookId: SIBLING_BOOK_ID, isSpoiler: false, name: "The Preacher" },
  { bookId: SIBLING_BOOK_ID, isSpoiler: true, name: "Emperor Paul" },
];

function select({
  contextBookId = CONTEXT_BOOK_ID,
  revealed = [],
}: {
  contextBookId?: Nullable<string>;
  revealed?: CharacterRevealFieldKey[];
}): { hiddenFields: string[]; names: string[] } {
  const result = selectVisibleAliases({
    aliases,
    contextBookId,
    revealedFields: new Set(revealed),
  });
  return {
    hiddenFields: [...result.hiddenFields].sort(),
    names: result.aliases.map((alias) => alias.name).sort(),
  };
}

describe("selectVisibleAliases in a book context", () => {
  it("withholds spoiler aliases of both groups and marks both group keys", () => {
    expect(select({})).toEqual({
      hiddenFields: ["bookAliases", "globalAliases"],
      names: ["Paul-Muad'Dib", "Usul"],
    });
  });

  it("reveals only the global group when globalAliases is sent", () => {
    expect(select({ revealed: ["globalAliases"] })).toEqual({
      hiddenFields: ["bookAliases"],
      names: ["Kwisatz Haderach", "Paul-Muad'Dib", "Usul"],
    });
  });

  it("reveals only the context book group when bookAliases is sent", () => {
    expect(select({ revealed: ["bookAliases"] })).toEqual({
      hiddenFields: ["globalAliases"],
      names: ["Lisan al-Gaib", "Paul-Muad'Dib", "Usul"],
    });
  });

  it("never returns another series book's aliases even with both groups revealed", () => {
    expect(select({ revealed: ["bookAliases", "globalAliases"] })).toEqual({
      hiddenFields: [],
      names: ["Kwisatz Haderach", "Lisan al-Gaib", "Paul-Muad'Dib", "Usul"],
    });
  });

  it("marks no group whose spoiler aliases are absent", () => {
    const result = selectVisibleAliases({
      aliases: aliases.filter((alias) => alias.bookId !== null || !alias.isSpoiler),
      contextBookId: CONTEXT_BOOK_ID,
      revealedFields: new Set(),
    });

    expect(result.hiddenFields).toEqual(["bookAliases"]);
  });
});

describe("selectVisibleAliases without a book context", () => {
  it("returns only non-spoiler global aliases and drops every book alias", () => {
    expect(select({ contextBookId: null })).toEqual({
      hiddenFields: ["globalAliases"],
      names: ["Usul"],
    });
  });

  it("returns every global alias and still no book alias when every key is revealed", () => {
    expect(select({ contextBookId: null, revealed: ["bookAliases", "globalAliases"] })).toEqual({
      hiddenFields: [],
      names: ["Kwisatz Haderach", "Usul"],
    });
  });
});

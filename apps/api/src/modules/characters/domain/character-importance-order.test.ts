import { BookCharacterImportanceSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import {
  BOOK_CHARACTER_IMPORTANCE_RANK,
  bookCharacterImportanceRank,
} from "./character-importance-order.js";

describe("book character importance rank", () => {
  it("ranks every importance the shared enum knows about", () => {
    expect(Object.keys(BOOK_CHARACTER_IMPORTANCE_RANK).sort()).toEqual(
      [...BookCharacterImportanceSchema.options].sort(),
    );
  });

  it("orders the explicit levels from central down to mentioned", () => {
    const shuffled: string[] = ["mentioned", "central", "episodic", "major", "supporting"];
    expect(
      shuffled.sort(
        (left, right) => bookCharacterImportanceRank(left) - bookCharacterImportanceRank(right),
      ),
    ).toEqual(["central", "major", "supporting", "episodic", "mentioned"]);
  });

  it("puts unspecified importance behind every explicit level", () => {
    const unspecified = bookCharacterImportanceRank("not_specified");
    for (const importance of BookCharacterImportanceSchema.options) {
      if (importance === "not_specified") {
        continue;
      }
      expect(bookCharacterImportanceRank(importance)).toBeLessThan(unspecified);
    }
  });

  it("rejects an importance the shared enum does not define", () => {
    expect(() => bookCharacterImportanceRank("legendary")).toThrow();
  });
});

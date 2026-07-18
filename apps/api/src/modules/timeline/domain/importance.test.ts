import { describe, expect, it } from "vitest";

import { importanceRank, resolveImportanceFilter } from "./importance.js";

describe("importanceRank", () => {
  it("ranks the levels from low to key", () => {
    expect(importanceRank("low")).toBe(0);
    expect(importanceRank("medium")).toBe(1);
    expect(importanceRank("high")).toBe(2);
    expect(importanceRank("key")).toBe(3);
  });
});

describe("resolveImportanceFilter", () => {
  it("expands the keyOnly preset to a key set", () => {
    expect(
      resolveImportanceFilter({ importance: undefined, important: undefined, keyOnly: true }),
    ).toEqual(["key"]);
  });

  it("expands the important preset to high and key", () => {
    expect(
      resolveImportanceFilter({ importance: undefined, important: true, keyOnly: undefined }),
    ).toEqual(["high", "key"]);
  });

  it("prefers keyOnly over important", () => {
    expect(
      resolveImportanceFilter({ importance: undefined, important: true, keyOnly: true }),
    ).toEqual(["key"]);
  });

  it("returns the multiselect when no preset is active", () => {
    expect(
      resolveImportanceFilter({
        importance: ["low", "medium"],
        important: undefined,
        keyOnly: undefined,
      }),
    ).toEqual(["low", "medium"]);
  });

  it("returns undefined when nothing is selected", () => {
    expect(
      resolveImportanceFilter({ importance: undefined, important: undefined, keyOnly: undefined }),
    ).toBeUndefined();
  });

  it("returns undefined when the multiselect is empty", () => {
    expect(
      resolveImportanceFilter({ importance: [], important: undefined, keyOnly: undefined }),
    ).toBeUndefined();
  });
});

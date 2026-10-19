import { describe, expect, it } from "vitest";

import { mergeTextUsage } from "./text-usage.js";

const UNLIMITED = 100;

describe("mergeTextUsage", () => {
  it("credits a spelling with all of its whitespace variants before choosing the dominant one", () => {
    const merged = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 2, text: " Kyiv" },
        { count: 2, text: "Kyiv  " },
        { count: 3, text: "kyiv" },
      ],
    });

    expect(merged).toEqual([{ count: 7, text: "Kyiv" }]);
  });

  it("picks the same dominant spelling whichever order the tied spellings arrive in", () => {
    const lowerFirst = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 4, text: "kyiv" },
        { count: 4, text: "Kyiv" },
      ],
    });
    const upperFirst = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 4, text: "Kyiv" },
        { count: 4, text: "kyiv" },
      ],
    });

    expect(lowerFirst).toEqual([{ count: 8, text: "Kyiv" }]);
    expect(upperFirst).toEqual([{ count: 8, text: "Kyiv" }]);
  });

  it("ranks groups by their merged count rather than by any single spelling", () => {
    const merged = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 3, text: "Arrakis" },
        { count: 2, text: "Kyiv" },
        { count: 2, text: "kyiv" },
      ],
    });

    expect(merged).toEqual([
      { count: 4, text: "Kyiv" },
      { count: 3, text: "Arrakis" },
    ]);
  });

  it("orders groups with equal counts alphabetically", () => {
    const merged = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 2, text: "Odesa" },
        { count: 2, text: "Kyiv" },
        { count: 2, text: "Lviv" },
      ],
    });

    expect(merged.map((usage) => usage.text)).toEqual(["Kyiv", "Lviv", "Odesa"]);
  });

  it("orders Cyrillic groups with equal counts by the Ukrainian alphabet", () => {
    const merged = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 2, text: "Їжакове" },
        { count: 2, text: "Ґорґани" },
        { count: 2, text: "Єрусалим" },
        { count: 2, text: "Арракіс" },
      ],
    });

    expect(merged.map((usage) => usage.text)).toEqual([
      "Арракіс",
      "Ґорґани",
      "Єрусалим",
      "Їжакове",
    ]);
  });

  it("merges spellings that differ only in inner whitespace into one group", () => {
    const merged = mergeTextUsage({
      limit: UNLIMITED,
      usages: [
        { count: 1, text: "Old  Town" },
        { count: 2, text: "Old Town" },
      ],
    });

    expect(merged).toEqual([{ count: 3, text: "Old Town" }]);
  });

  it("applies the limit after merging, keeping the most used groups", () => {
    const merged = mergeTextUsage({
      limit: 1,
      usages: [
        { count: 2, text: "Lviv" },
        { count: 2, text: "Kyiv" },
        { count: 1, text: "KYIV" },
      ],
    });

    expect(merged).toEqual([{ count: 3, text: "Kyiv" }]);
  });

  it("drops blank values without letting them take a slot of the limit", () => {
    const merged = mergeTextUsage({
      limit: 2,
      usages: [
        { count: 9, text: "   " },
        { count: 8, text: "" },
        { count: 1, text: "Arrakis" },
        { count: 2, text: "Kyiv" },
      ],
    });

    expect(merged).toEqual([
      { count: 2, text: "Kyiv" },
      { count: 1, text: "Arrakis" },
    ]);
  });
});

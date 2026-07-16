import { describe, expect, it } from "vitest";

import { emptyToNull, resolveCustomCategory } from "./note-fields.js";

describe("emptyToNull", () => {
  it("returns null for undefined, null and blank strings", () => {
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("   ")).toBeNull();
  });

  it("trims and preserves non-empty strings", () => {
    expect(emptyToNull("  Chapter III  ")).toBe("Chapter III");
  });
});

describe("resolveCustomCategory", () => {
  it("keeps the custom category only when the category is other", () => {
    expect(resolveCustomCategory({ category: "other", customCategory: "love line" })).toBe(
      "love line",
    );
  });

  it("discards the custom category for any non-other category", () => {
    expect(
      resolveCustomCategory({ category: "characters", customCategory: "love line" }),
    ).toBeNull();
    expect(resolveCustomCategory({ category: null, customCategory: "love line" })).toBeNull();
  });

  it("returns null when other is chosen without a custom label", () => {
    expect(resolveCustomCategory({ category: "other", customCategory: null })).toBeNull();
    expect(resolveCustomCategory({ category: "other", customCategory: "  " })).toBeNull();
  });
});

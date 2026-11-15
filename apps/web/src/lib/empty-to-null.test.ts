import { describe, expect, it } from "vitest";

import { emptyToNull } from "./empty-to-null";

describe("emptyToNull", () => {
  it("keeps a filled value without its surrounding whitespace", () => {
    expect(emptyToNull("  ORD-2041 ")).toBe("ORD-2041");
  });

  it("turns an empty string into null", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("turns a whitespace-only string into null", () => {
    expect(emptyToNull("   ")).toBeNull();
  });

  it("turns a value that is not a string into null", () => {
    expect(emptyToNull(undefined)).toBeNull();
  });
});

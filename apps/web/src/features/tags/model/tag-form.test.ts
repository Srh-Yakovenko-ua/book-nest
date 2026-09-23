import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/http-client";

import { isDuplicateTagNameError, toTagUpdatePatch } from "./tag-form";

const ORIGINAL = {
  color: "rose",
  description: null,
  name: "slow burn",
  type: "trope",
} as const;

describe("toTagUpdatePatch", () => {
  it("is empty when nothing meaningful changed", () => {
    expect(toTagUpdatePatch({ ...ORIGINAL, description: "" }, ORIGINAL)).toEqual({});
  });

  it("carries only the fields that differ from the original tag", () => {
    expect(
      toTagUpdatePatch(
        { color: "sage", description: "", name: "slow burn", type: "theme" },
        ORIGINAL,
      ),
    ).toEqual({ color: "sage", type: "theme" });
  });

  it("clears a description with null and sets a new one as text", () => {
    expect(
      toTagUpdatePatch({ ...ORIGINAL, description: "" }, { ...ORIGINAL, description: "old" }),
    ).toEqual({ description: null });
    expect(toTagUpdatePatch({ ...ORIGINAL, description: "new" }, ORIGINAL)).toEqual({
      description: "new",
    });
  });
});

describe("isDuplicateTagNameError", () => {
  it("recognises only a 409 API error", () => {
    expect(isDuplicateTagNameError(new ApiError(409, "conflict"))).toBe(true);
    expect(isDuplicateTagNameError(new ApiError(500, "boom"))).toBe(false);
    expect(isDuplicateTagNameError(new Error("boom"))).toBe(false);
  });
});

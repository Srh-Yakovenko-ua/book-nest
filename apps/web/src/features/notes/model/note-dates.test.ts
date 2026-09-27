import { describe, expect, it } from "vitest";

import { isMeaningfullyUpdated } from "./note-dates";

const CREATED_AT = "2026-01-05T10:00:00.000Z";

describe("isMeaningfullyUpdated", () => {
  it("is false for a note that was never edited", () => {
    expect(isMeaningfullyUpdated({ createdAt: CREATED_AT, updatedAt: CREATED_AT })).toBe(false);
  });

  it("is false for an edit 59 seconds after creation", () => {
    expect(
      isMeaningfullyUpdated({ createdAt: CREATED_AT, updatedAt: "2026-01-05T10:00:59.999Z" }),
    ).toBe(false);
  });

  it("is true for an edit exactly one minute after creation", () => {
    expect(
      isMeaningfullyUpdated({ createdAt: CREATED_AT, updatedAt: "2026-01-05T10:01:00.000Z" }),
    ).toBe(true);
  });

  it("is true for an edit days after creation", () => {
    expect(
      isMeaningfullyUpdated({ createdAt: CREATED_AT, updatedAt: "2026-01-09T08:30:00.000Z" }),
    ).toBe(true);
  });

  it("is false when the update stamp precedes creation", () => {
    expect(
      isMeaningfullyUpdated({ createdAt: CREATED_AT, updatedAt: "2026-01-05T09:00:00.000Z" }),
    ).toBe(false);
  });
});

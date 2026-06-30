import { describe, expect, it } from "vitest";

import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it("accepts a simple internal path", () => {
    expect(safeInternalPath("/library")).toBe("/library");
  });

  it("accepts an internal path with a query string", () => {
    expect(safeInternalPath("/x?y=1")).toBe("/x?y=1");
  });

  it("rejects a protocol-relative url", () => {
    expect(safeInternalPath("//evil.com")).toBeNull();
  });

  it("rejects an absolute https url", () => {
    expect(safeInternalPath("https://evil.com")).toBeNull();
  });

  it("rejects a backslash-prefixed bypass", () => {
    expect(safeInternalPath("/\\evil")).toBeNull();
  });

  it("rejects a javascript scheme", () => {
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(safeInternalPath("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(safeInternalPath(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(safeInternalPath(undefined)).toBeNull();
  });
});

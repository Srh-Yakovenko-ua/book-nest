import { describe, expect, it } from "vitest";

import { resolvePatchedRoleLabels } from "./character-relationship-write.js";

const NO_STORED_ROLES = { sourceLabel: null, targetLabel: null };

const STORED_ROLES = { sourceLabel: "Mentor", targetLabel: "Pupil" };

describe("resolvePatchedRoleLabels", () => {
  it("E02 returns every sent role with its display label and normalized key", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: NO_STORED_ROLES,
        input: { sourceLabel: "Mentor", targetLabel: "Young Apprentice" },
      }),
    ).toEqual([
      { label: "Mentor", normalizedLabel: "mentor" },
      { label: "Young Apprentice", normalizedLabel: "young apprentice" },
    ]);
  });

  it("ignores a side the patch does not send, even when that side has a stored role", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: { sourceLabel: null, targetLabel: "Pupil" },
        input: { sourceLabel: "Mentor" },
      }),
    ).toEqual([{ label: "Mentor", normalizedLabel: "mentor" }]);
  });

  it("E03 returns nothing when both sides are cleared with null", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: STORED_ROLES,
        input: { sourceLabel: null, targetLabel: null },
      }),
    ).toEqual([]);
  });

  it("E03 returns nothing when both sides are cleared with blank text", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: STORED_ROLES,
        input: { sourceLabel: "", targetLabel: " \t  " },
      }),
    ).toEqual([]);
  });

  it("E05 collapses inner and outer whitespace in the display label", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: NO_STORED_ROLES,
        input: { sourceLabel: "  Old \t  Mentor  " },
      }),
    ).toEqual([{ label: "Old Mentor", normalizedLabel: "old mentor" }]);
  });

  it("keeps a role of exactly 120 characters", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: NO_STORED_ROLES,
        input: { sourceLabel: "x".repeat(120) },
      }),
    ).toEqual([{ label: "x".repeat(120), normalizedLabel: "x".repeat(120) }]);
  });

  it("skips a role longer than 120 characters", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: NO_STORED_ROLES,
        input: { sourceLabel: "x".repeat(121) },
      }),
    ).toEqual([]);
  });

  it("measures the 120 character limit after collapsing whitespace", () => {
    const collapsed = `${"x".repeat(60)} ${"y".repeat(59)}`;

    expect(
      resolvePatchedRoleLabels({
        existing: NO_STORED_ROLES,
        input: { sourceLabel: `${"x".repeat(60)}${" ".repeat(10)}${"y".repeat(59)}` },
      }),
    ).toEqual([{ label: collapsed, normalizedLabel: collapsed }]);
  });

  it("returns nothing when both sides re-send their stored roles", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: STORED_ROLES,
        input: { sourceLabel: "Mentor", targetLabel: "Pupil" },
      }),
    ).toEqual([]);
  });

  it("treats a whitespace-only difference from the stored role as unchanged", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: { sourceLabel: "Old   Mentor", targetLabel: null },
        input: { sourceLabel: " Old Mentor " },
      }),
    ).toEqual([]);
  });

  it("compares each side with its own stored role, so swapped roles both count as changes", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: STORED_ROLES,
        input: { sourceLabel: "Pupil", targetLabel: "Mentor" },
      }),
    ).toEqual([
      { label: "Mentor", normalizedLabel: "mentor" },
      { label: "Pupil", normalizedLabel: "pupil" },
    ]);
  });

  it("E05 returns a case-only change of a stored role with the sent spelling", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: STORED_ROLES,
        input: { sourceLabel: "MENTOR" },
      }),
    ).toEqual([{ label: "MENTOR", normalizedLabel: "mentor" }]);
  });

  it("E05 returns one entry when both sides share a normalized key", () => {
    const patched = resolvePatchedRoleLabels({
      existing: NO_STORED_ROLES,
      input: { sourceLabel: "Twin", targetLabel: "  TWIN " },
    });

    expect(patched).toHaveLength(1);
    expect(patched[0]?.normalizedLabel).toBe("twin");
  });

  it("orders the entries by normalized key rather than by side", () => {
    expect(
      resolvePatchedRoleLabels({
        existing: NO_STORED_ROLES,
        input: { sourceLabel: "Pupil", targetLabel: "Mentor" },
      }),
    ).toEqual([
      { label: "Mentor", normalizedLabel: "mentor" },
      { label: "Pupil", normalizedLabel: "pupil" },
    ]);
  });
});

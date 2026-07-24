import { describe, expect, it } from "vitest";

import {
  buildRelationshipLockKey,
  canonicalizeRelationshipEndpoints,
  detectFamilyDiagnostics,
} from "./character-relationship-graph.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("canonicalizeRelationshipEndpoints", () => {
  it("keeps the order for directed edges", () => {
    const result = canonicalizeRelationshipEndpoints({
      directionality: "directed",
      sourceCharacterId: BOB,
      sourceLabel: "mentor",
      targetCharacterId: ALICE,
      targetLabel: "student",
    });

    expect(result).toEqual({
      sourceCharacterId: BOB,
      sourceLabel: "mentor",
      targetCharacterId: ALICE,
      targetLabel: "student",
    });
  });

  it("orders symmetric edges by id and swaps the labels with them", () => {
    const result = canonicalizeRelationshipEndpoints({
      directionality: "symmetric",
      sourceCharacterId: BOB,
      sourceLabel: "husband",
      targetCharacterId: ALICE,
      targetLabel: "wife",
    });

    expect(result).toEqual({
      sourceCharacterId: ALICE,
      sourceLabel: "wife",
      targetCharacterId: BOB,
      targetLabel: "husband",
    });
  });
});

describe("buildRelationshipLockKey", () => {
  it("produces the same key for a symmetric pair regardless of order", () => {
    const forward = buildRelationshipLockKey({
      directionality: "symmetric",
      normalizedCustomType: null,
      sourceCharacterId: ALICE,
      targetCharacterId: BOB,
      type: "spouse_of",
      userId: USER_ID,
    });
    const backward = buildRelationshipLockKey({
      directionality: "symmetric",
      normalizedCustomType: null,
      sourceCharacterId: ALICE,
      targetCharacterId: BOB,
      type: "spouse_of",
      userId: USER_ID,
    });

    expect(forward).toBe(backward);
    expect(forward.startsWith("crel:")).toBe(true);
  });

  it("folds the normalized custom type into the key for custom edges", () => {
    const key = buildRelationshipLockKey({
      directionality: "directed",
      normalizedCustomType: "sworn rival",
      sourceCharacterId: ALICE,
      targetCharacterId: BOB,
      type: "custom",
      userId: USER_ID,
    });

    expect(key).toContain("custom:sworn rival");
  });
});

describe("detectFamilyDiagnostics", () => {
  it("returns nothing for a symmetric family type", () => {
    const diagnostics = detectFamilyDiagnostics({
      candidate: { sourceCharacterId: ALICE, targetCharacterId: BOB, type: "sibling_of" },
      existingEdges: [],
    });

    expect(diagnostics).toEqual([]);
  });

  it("flags a direct parent contradiction as a conflict", () => {
    const diagnostics = detectFamilyDiagnostics({
      candidate: { sourceCharacterId: ALICE, targetCharacterId: BOB, type: "biological_parent_of" },
      existingEdges: [
        { sourceCharacterId: BOB, targetCharacterId: ALICE, type: "biological_parent_of" },
      ],
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe("conflict");
  });

  it("flags a deeper ancestry cycle as a warning", () => {
    const diagnostics = detectFamilyDiagnostics({
      candidate: {
        sourceCharacterId: CAROL,
        targetCharacterId: ALICE,
        type: "biological_parent_of",
      },
      existingEdges: [
        { sourceCharacterId: ALICE, targetCharacterId: BOB, type: "biological_parent_of" },
        { sourceCharacterId: BOB, targetCharacterId: CAROL, type: "biological_parent_of" },
      ],
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe("warning");
  });

  it("returns nothing when no cycle is closed", () => {
    const diagnostics = detectFamilyDiagnostics({
      candidate: { sourceCharacterId: ALICE, targetCharacterId: BOB, type: "biological_parent_of" },
      existingEdges: [
        { sourceCharacterId: ALICE, targetCharacterId: CAROL, type: "biological_parent_of" },
      ],
    });

    expect(diagnostics).toEqual([]);
  });
});

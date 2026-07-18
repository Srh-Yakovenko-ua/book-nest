import { describe, expect, it } from "vitest";

import {
  appendPosition,
  computeSparsePosition,
  TIMELINE_POSITION_STEP,
} from "./sparse-position.js";

describe("computeSparsePosition", () => {
  it("returns the step for an empty scope", () => {
    expect(computeSparsePosition({ after: null, before: null })).toEqual({
      ok: true,
      position: TIMELINE_POSITION_STEP,
    });
  });

  it("appends after the last neighbor when moving to the end", () => {
    expect(computeSparsePosition({ after: 4096, before: null })).toEqual({
      ok: true,
      position: 4096 + TIMELINE_POSITION_STEP,
    });
  });

  it("places before the first neighbor when moving to the start", () => {
    expect(computeSparsePosition({ after: null, before: 4096 })).toEqual({
      ok: true,
      position: 4096 - TIMELINE_POSITION_STEP,
    });
  });

  it("halves the position when the start has no full step but still has room", () => {
    expect(computeSparsePosition({ after: null, before: 1024 })).toEqual({
      ok: true,
      position: 512,
    });
  });

  it("requests a rebalance when the start has no room", () => {
    expect(computeSparsePosition({ after: null, before: 1 })).toEqual({
      needsRebalance: true,
      ok: false,
    });
  });

  it("computes the midpoint between two neighbors", () => {
    expect(computeSparsePosition({ after: 1024, before: 2048 })).toEqual({
      ok: true,
      position: 1536,
    });
  });

  it("requests a rebalance when neighbors are adjacent integers", () => {
    expect(computeSparsePosition({ after: 1024, before: 1025 })).toEqual({
      needsRebalance: true,
      ok: false,
    });
  });

  it("requests a rebalance when neighbors are equal", () => {
    expect(computeSparsePosition({ after: 1024, before: 1024 })).toEqual({
      needsRebalance: true,
      ok: false,
    });
  });
});

describe("appendPosition", () => {
  it("returns the step for an empty scope", () => {
    expect(appendPosition(null)).toBe(TIMELINE_POSITION_STEP);
  });

  it("advances one step beyond the current maximum", () => {
    expect(appendPosition(5000)).toBe(5000 + TIMELINE_POSITION_STEP);
  });
});

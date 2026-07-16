import type { Nullable } from "@app/shared";

export const TIMELINE_POSITION_STEP = 1024;

export type SparsePositionResult =
  | { needsRebalance: true; ok: false }
  | { ok: true; position: number };

export function appendPosition(maxPosition: Nullable<number>): number {
  return (maxPosition ?? 0) + TIMELINE_POSITION_STEP;
}

export function computeSparsePosition({
  after,
  before,
}: {
  after: Nullable<number>;
  before: Nullable<number>;
}): SparsePositionResult {
  if (after !== null && before !== null) {
    if (before - after <= 1) {
      return { needsRebalance: true, ok: false };
    }
    return { ok: true, position: Math.floor((after + before) / 2) };
  }
  if (after !== null) {
    return { ok: true, position: after + TIMELINE_POSITION_STEP };
  }
  if (before !== null) {
    const candidate = before - TIMELINE_POSITION_STEP;
    if (candidate > 0) {
      return { ok: true, position: candidate };
    }
    if (before <= 1) {
      return { needsRebalance: true, ok: false };
    }
    return { ok: true, position: Math.floor(before / 2) };
  }
  return { ok: true, position: TIMELINE_POSITION_STEP };
}

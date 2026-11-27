import { describe, expect, it, vi } from "vitest";

import type { CollectionPresence } from "./collection-presence";

import { toCollectionPresence, withPresenceRetry } from "./collection-presence";

type Overview = { summary: { total: number } };

type QueryOverrides = Partial<{ data: Overview; isLoadingError: boolean; isPending: boolean }>;

function overviewQuery(overrides: QueryOverrides = {}) {
  return {
    data: overrides.data,
    isLoadingError: overrides.isLoadingError ?? false,
    isPending: overrides.isPending ?? false,
    refetch: vi.fn(() => Promise.resolve()),
  };
}

function presenceOf(query: ReturnType<typeof overviewQuery>) {
  return toCollectionPresence({ query, total: (data: Overview) => data.summary.total });
}

describe("toCollectionPresence", () => {
  it("reports an error when the first load failed and no data came back", () => {
    expect(presenceOf(overviewQuery({ isLoadingError: true })).kind).toBe("error");
  });

  it("puts the error ahead of a pending flag", () => {
    expect(presenceOf(overviewQuery({ isLoadingError: true, isPending: true })).kind).toBe("error");
  });

  it("refetches the query from the error retry", () => {
    const query = overviewQuery({ isLoadingError: true });
    const presence = presenceOf(query);

    if (presence.kind !== "error") throw new Error(`expected error, got ${presence.kind}`);
    presence.retry();

    expect(query.refetch).toHaveBeenCalledOnce();
  });

  it("stays pending while the query loads", () => {
    expect(presenceOf(overviewQuery({ isPending: true }))).toEqual({ kind: "pending" });
  });

  it("stays pending when the query settled without data", () => {
    expect(presenceOf(overviewQuery())).toEqual({ kind: "pending" });
  });

  it("reports the total once the data arrives", () => {
    expect(presenceOf(overviewQuery({ data: { summary: { total: 7 } } }))).toEqual({
      kind: "ready",
      total: 7,
    });
  });

  it("treats an empty collection as ready with a zero total", () => {
    expect(presenceOf(overviewQuery({ data: { summary: { total: 0 } } }))).toEqual({
      kind: "ready",
      total: 0,
    });
  });
});

describe("withPresenceRetry", () => {
  it("runs the wrapper around the original error retry", () => {
    const calls: string[] = [];
    const presence: CollectionPresence = {
      kind: "error",
      retry: () => {
        calls.push("retry");
      },
    };

    const wrapped = withPresenceRetry({
      presence,
      wrapRetry: (retry) => () => {
        calls.push("wrapper");
        retry();
      },
    });

    if (wrapped.kind !== "error") throw new Error(`expected error, got ${wrapped.kind}`);
    wrapped.retry();

    expect(calls).toEqual(["wrapper", "retry"]);
  });

  it.each<{ case: string; presence: CollectionPresence }>([
    { case: "pending", presence: { kind: "pending" } },
    { case: "ready", presence: { kind: "ready", total: 3 } },
  ])("hands a $case presence back untouched", ({ presence }) => {
    const wrapRetry = vi.fn((retry: () => void) => retry);

    expect(withPresenceRetry({ presence, wrapRetry })).toBe(presence);
    expect(wrapRetry).not.toHaveBeenCalled();
  });
});

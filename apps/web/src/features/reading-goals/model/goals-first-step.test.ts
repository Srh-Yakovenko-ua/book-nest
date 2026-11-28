import { describe, expect, it, vi } from "vitest";

import type { CollectionPresence } from "./goals-first-step";

import { resolveGoalsFirstStep } from "./goals-first-step";

const LIBRARY_WITH_BOOKS: CollectionPresence = { kind: "ready", total: 12 };

const EMPTY_LIBRARY: CollectionPresence = { kind: "ready", total: 0 };

const ELIGIBLE_LISTS: CollectionPresence = { kind: "ready", total: 2 };

const NO_ELIGIBLE_LISTS: CollectionPresence = { kind: "ready", total: 0 };

describe("resolveGoalsFirstStep", () => {
  it.each<[string, CollectionPresence]>([
    ["no eligible lists", NO_ELIGIBLE_LISTS],
    ["lists still loading", { kind: "pending" }],
  ])("asks for the first book in an empty library with %s", (_label, eligibleLists) => {
    expect(resolveGoalsFirstStep({ eligibleLists, library: EMPTY_LIBRARY })).toEqual({
      kind: "add-first-book",
    });
  });

  it("sends a library without a list of books to the lists", () => {
    expect(
      resolveGoalsFirstStep({ eligibleLists: NO_ELIGIBLE_LISTS, library: LIBRARY_WITH_BOOKS }),
    ).toEqual({ kind: "fill-list" });
  });

  it("starts picking a list once an eligible list exists", () => {
    expect(
      resolveGoalsFirstStep({ eligibleLists: ELIGIBLE_LISTS, library: LIBRARY_WITH_BOOKS }),
    ).toEqual({ kind: "create-goal" });
  });

  it.each<[string, CollectionPresence, CollectionPresence]>([
    ["the library", { kind: "pending" }, ELIGIBLE_LISTS],
    ["the eligible lists", LIBRARY_WITH_BOOKS, { kind: "pending" }],
  ])("waits while %s is pending", (_label, library, eligibleLists) => {
    expect(resolveGoalsFirstStep({ eligibleLists, library })).toEqual({ kind: "pending" });
  });

  it("offers the library retry when the library fails", () => {
    const retry = vi.fn();

    expect(
      resolveGoalsFirstStep({
        eligibleLists: ELIGIBLE_LISTS,
        library: { kind: "error", retry },
      }),
    ).toEqual({ kind: "error", retry });
  });

  it("offers the lists retry when the eligible lists fail", () => {
    const retry = vi.fn();

    expect(
      resolveGoalsFirstStep({
        eligibleLists: { kind: "error", retry },
        library: LIBRARY_WITH_BOOKS,
      }),
    ).toEqual({ kind: "error", retry });
  });
});

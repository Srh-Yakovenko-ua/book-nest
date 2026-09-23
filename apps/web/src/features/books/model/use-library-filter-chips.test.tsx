import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";

import type { LibraryQueryState } from "./library-query";

import { countAdvancedFilterChips, useLibraryFilterChips } from "./use-library-filter-chips";

function makeState(overrides: Partial<LibraryQueryState> = {}): LibraryQueryState {
  return {
    ageCategory: [],
    author: [],
    bookType: null,
    format: [],
    genre: [],
    hasCover: null,
    hasRating: null,
    isFavorite: null,
    language: [],
    owner: [],
    pagesMax: null,
    pagesMin: null,
    publisher: [],
    publisherPresence: "all",
    q: "",
    ratingMax: null,
    ratingMin: null,
    sort: "created_desc",
    status: [],
    tag: [],
    view: "grid",
    yearMax: null,
    yearMin: null,
    ...overrides,
  };
}

function renderChips(state: LibraryQueryState) {
  const setState = vi.fn();
  const { result } = renderHook(
    () =>
      useLibraryFilterChips({
        genreName: (key) => key,
        resolveEntityName: () => undefined,
        setState,
        state,
      }),
    { wrapper },
  );
  return { chips: result.current, setState };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="uk" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useLibraryFilterChips publisherPresence", () => {
  it.each([
    ["missing", "Без видавництва"],
    ["assigned", "З видавництвом"],
  ] as const)("labels %s as %s", (publisherPresence, label) => {
    const { chips } = renderChips(makeState({ publisherPresence }));
    expect(chips.map((chip) => chip.label)).toEqual([label]);
  });

  it("removes only publisherPresence", () => {
    const { chips, setState } = renderChips(
      makeState({ publisherPresence: "missing", q: "Кобзар", status: ["reading"] }),
    );

    chips.find((chip) => chip.label === "Без видавництва")?.onRemove();

    expect(setState).toHaveBeenCalledWith({ publisherPresence: null });
  });

  it("keeps q and publisherPresence out of the Advanced badge count", () => {
    const { chips } = renderChips(
      makeState({ publisherPresence: "missing", q: "Кобзар", status: ["reading"] }),
    );

    expect(chips).toHaveLength(3);
    expect(countAdvancedFilterChips(chips)).toBe(1);
  });
});

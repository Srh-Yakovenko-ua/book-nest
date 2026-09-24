import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";

import type { LibraryQueryState } from "./library-query";

import { countAdvancedFilterChips, useLibraryFilterChips } from "./use-library-filter-chips";

const VAMPIRES_TAG_ID = "0b6f7b1e-4a5f-4a2b-9a51-1c1f0b8a9e01";

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
        resolveTag: (id) =>
          id === VAMPIRES_TAG_ID ? { color: "lavender", id, name: "вампіри" } : undefined,
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

describe("useLibraryFilterChips tags", () => {
  it("names a tag chip and paints it in the tag color", () => {
    const { chips } = renderChips(makeState({ tag: [VAMPIRES_TAG_ID] }));

    expect(chips).toEqual([expect.objectContaining({ label: "вампіри", tagColor: "lavender" })]);
  });

  it("paints a tag it cannot resolve as parchment", () => {
    const { chips } = renderChips(makeState({ tag: ["missing-tag"] }));

    expect(chips).toEqual([expect.objectContaining({ tagColor: "parchment" })]);
  });
});

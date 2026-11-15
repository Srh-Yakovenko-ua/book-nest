import type { Nullable } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readBookFormDraft } from "./book-form-draft";

const STORAGE_KEY = "book-form-draft:edit:book-1";
const BOOK_UPDATED_AT = "2026-11-10T08:00:00.000Z";
const OLDER_BOOK_UPDATED_AT = "2026-11-09T08:00:00.000Z";

function storeDraft({
  bookUpdatedAt,
  locale,
  values = { title: "Кобзар" },
}: {
  bookUpdatedAt: Nullable<string>;
  locale: string;
  values?: Record<string, unknown>;
}) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      authorSelections: [],
      bookUpdatedAt,
      loanContactSelection: null,
      locale,
      publisherEdited: false,
      publisherQuery: "",
      publisherSelection: null,
      seriesSelection: null,
      values,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("readBookFormDraft", () => {
  it("restores an edit draft saved against the current book version after a locale switch", () => {
    storeDraft({ bookUpdatedAt: BOOK_UPDATED_AT, locale: "en" });

    const draft = readBookFormDraft({
      bookUpdatedAt: BOOK_UPDATED_AT,
      locale: "uk",
      storageKey: STORAGE_KEY,
    });

    expect(draft).toMatchObject({ bookUpdatedAt: BOOK_UPDATED_AT, values: { title: "Кобзар" } });
  });

  it("drops an edit draft saved against an older book version", () => {
    storeDraft({ bookUpdatedAt: OLDER_BOOK_UPDATED_AT, locale: "en" });

    const draft = readBookFormDraft({
      bookUpdatedAt: BOOK_UPDATED_AT,
      locale: "uk",
      storageKey: STORAGE_KEY,
    });

    expect(draft).toBeNull();
  });

  it("removes the stale edit draft from session storage", () => {
    storeDraft({ bookUpdatedAt: OLDER_BOOK_UPDATED_AT, locale: "en" });

    readBookFormDraft({ bookUpdatedAt: BOOK_UPDATED_AT, locale: "uk", storageKey: STORAGE_KEY });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores a create draft, which carries no book version", () => {
    storeDraft({ bookUpdatedAt: null, locale: "en" });

    const draft = readBookFormDraft({ bookUpdatedAt: null, locale: "uk", storageKey: STORAGE_KEY });

    expect(draft).toMatchObject({ bookUpdatedAt: null, values: { title: "Кобзар" } });
  });

  it("restores partly typed input exactly as the user left it", () => {
    const unfinishedValues = {
      isbn: "978-61",
      purchaseInfo: { currency: "UAH", expectedPrice: -5, storeUrl: "knyharnia" },
      title: "  Кобзар  ",
    };
    storeDraft({ bookUpdatedAt: null, locale: "en", values: unfinishedValues });

    const draft = readBookFormDraft({ bookUpdatedAt: null, locale: "uk", storageKey: STORAGE_KEY });

    expect(draft?.values).toEqual(unfinishedValues);
  });

  it("drops only the fields whose stored value has the wrong shape for the form", () => {
    storeDraft({
      bookUpdatedAt: null,
      locale: "en",
      values: { isbn: 978_617, notAFormField: "x", purchaseInfo: "UAH", title: "Кобзар" },
    });

    const draft = readBookFormDraft({ bookUpdatedAt: null, locale: "uk", storageKey: STORAGE_KEY });

    expect(draft?.values).toEqual({ title: "Кобзар" });
  });

  it("reads no draft instead of crashing when session storage refuses access", () => {
    storeDraft({ bookUpdatedAt: BOOK_UPDATED_AT, locale: "en" });
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      removeItem: vi.fn(),
      setItem: vi.fn(),
    });

    const draft = readBookFormDraft({
      bookUpdatedAt: BOOK_UPDATED_AT,
      locale: "uk",
      storageKey: STORAGE_KEY,
    });

    expect(draft).toBeNull();
  });
});

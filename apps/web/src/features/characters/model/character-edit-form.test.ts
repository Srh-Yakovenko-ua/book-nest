import { describe, expect, it } from "vitest";

import {
  emptyBookScopeValues,
  isScopeDirty,
  toBookUpdate,
  toCharacterEditValues,
  toGlobalUpdate,
} from "./character-edit-form";
import { resolveInherited } from "./character-inheritance";
import { makeBookCharacterView, makeCharacterDetails } from "./characters.fixtures";

const character = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({
      attitude: null,
      bookId: "book-1",
      displayName: null,
      speciesOverride: "Мутант",
    }),
  ],
  globalAttitude: "like",
  name: "Ґеральт",
  species: "Відьмак",
});

describe("toCharacterEditValues inheritance state", () => {
  it("reads an absent book value as inherited and a present one as book-specific", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(values.book.displayName).toBeNull();
    expect(values.book.attitude).toBeNull();
    expect(values.book.speciesOverride).toBe("Мутант");
  });

  it("falls back to the empty book scope when the route book has no appearance", () => {
    expect(toCharacterEditValues(character, "book-404").book).toEqual(emptyBookScopeValues());
  });
});

describe("toBookUpdate inheritance payload", () => {
  it("sends null for an inherited field and the value for a book-specific one", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(toBookUpdate(values.book)).toMatchObject({
      attitude: null,
      displayName: null,
      speciesOverride: "Мутант",
    });
  });

  it("treats a book-specific but blank value as no book value", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(toBookUpdate({ ...values.book, displayName: "   " })).toMatchObject({
      displayName: null,
    });
  });

  it("omits a masked field so a save cannot wipe what it could not show", () => {
    const values = toCharacterEditValues(character, "book-1");
    const payload = toBookUpdate(values.book, ["displayName", "portrait"]);

    expect(payload).not.toHaveProperty("displayName");
    expect(payload).not.toHaveProperty("portraitMediaId");
    expect(payload).toHaveProperty("speciesOverride", "Мутант");
  });
});

describe("isScopeDirty", () => {
  it("ignores a change that maps to the same request", () => {
    const baseline = toCharacterEditValues(character, "book-1");
    const current = {
      ...baseline,
      global: { ...baseline.global, name: "  Ґеральт  " },
    };

    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(false);
  });

  it("sees a reset to the global value as a book change", () => {
    const baseline = toCharacterEditValues(character, "book-1");
    const current = { ...baseline, book: { ...baseline.book, speciesOverride: null } };

    expect(isScopeDirty({ baseline, current, scope: "book" })).toBe(true);
    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(false);
  });

  it("stays clean for a masked field the form cannot touch", () => {
    const baseline = toCharacterEditValues(character, "book-1");
    const current = { ...baseline, book: { ...baseline.book, displayName: "Білий Вовк" } };

    expect(isScopeDirty({ baseline, current, maskedFields: ["displayName"], scope: "book" })).toBe(
      false,
    );
  });
});

describe("toGlobalUpdate", () => {
  it("clears the custom gender unless the gender is custom", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(toGlobalUpdate({ ...values.global, customGender: "Щось" })).toMatchObject({
      customGender: null,
    });
    expect(
      toGlobalUpdate({ ...values.global, customGender: "Щось", gender: "custom" }),
    ).toMatchObject({ customGender: "Щось" });
  });
});

describe("resolveInherited", () => {
  it("returns the global value while the book value is absent", () => {
    expect(resolveInherited({ bookValue: null, globalValue: "Ґеральт" })).toEqual({
      effective: "Ґеральт",
      isInherited: true,
    });
    expect(resolveInherited({ bookValue: "Білий Вовк", globalValue: "Ґеральт" })).toEqual({
      effective: "Білий Вовк",
      isInherited: false,
    });
  });
});

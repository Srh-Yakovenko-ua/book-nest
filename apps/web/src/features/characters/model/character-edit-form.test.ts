import { describe, expect, it } from "vitest";

import type { CharacterEditValues } from "./character-edit-form";

import {
  emptyBookScopeValues,
  isScopeDirty,
  maskedEditFields,
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

describe("first appearance", () => {
  it("round-trips a non-numeric chapter and keeps the page optional", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(toBookUpdate({ ...values.book, firstAppearanceChapter: "Пролог" })).toMatchObject({
      firstAppearanceChapter: "Пролог",
      firstAppearancePage: null,
    });
  });

  it("accepts a positive page and rejects anything else", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(toBookUpdate({ ...values.book, firstAppearancePage: "47" })).toMatchObject({
      firstAppearancePage: 47,
    });
    expect(toBookUpdate({ ...values.book, firstAppearancePage: "0" })).toMatchObject({
      firstAppearancePage: null,
    });
    expect(toBookUpdate({ ...values.book, firstAppearancePage: "сорок" })).toMatchObject({
      firstAppearancePage: null,
    });
  });

  it("does not require one first-appearance field because another is filled", () => {
    const values = toCharacterEditValues(character, "book-1");

    expect(
      toBookUpdate({ ...values.book, firstAppearanceNote: "З'являється у трактирі" }),
    ).toMatchObject({
      firstAppearanceChapter: null,
      firstAppearanceNote: "З'являється у трактирі",
      firstAppearancePage: null,
    });
  });
});

describe("toBookUpdate roles", () => {
  it("keeps the custom text only for custom roles and numbers the roles in their order", () => {
    const values = toCharacterEditValues(character, "book-1");

    const payload = toBookUpdate({
      ...values.book,
      roles: [
        { customRole: "Залишок старого тексту", isSpoiler: false, roleType: "antagonist" },
        { customRole: "  Наставник  ", isSpoiler: true, roleType: "custom" },
        { customRole: "", isSpoiler: false, roleType: "protagonist" },
      ],
    });

    expect(payload.roles).toEqual([
      { customRole: null, isSpoiler: false, position: 0, roleType: "antagonist" },
      { customRole: "Наставник", isSpoiler: true, position: 1, roleType: "custom" },
      { customRole: null, isSpoiler: false, position: 2, roleType: "protagonist" },
    ]);
  });
});

describe("point of view", () => {
  it("clears the narrator type once the character stops being a point of view", () => {
    const values = toCharacterEditValues(character, "book-1");
    const pov = { ...values.book, isPovCharacter: true, narratorType: "unreliable" } as const;

    expect(toBookUpdate(pov)).toMatchObject({ isPovCharacter: true, narratorType: "unreliable" });
    expect(toBookUpdate({ ...pov, isPovCharacter: false })).toMatchObject({
      isPovCharacter: false,
      narratorType: null,
    });
  });
});

const spoilerCharacter = makeCharacterDetails({
  aliases: [
    {
      bookId: null,
      id: "alias-global-plain",
      isSpoiler: false,
      name: "Ґвинблейд",
      position: 0,
      type: "nickname",
    },
    {
      bookId: null,
      id: "alias-global-spoiler",
      isSpoiler: true,
      name: "Білий Вовк",
      position: 1,
      type: "title",
    },
    {
      bookId: "book-1",
      id: "alias-book-spoiler",
      isSpoiler: true,
      name: "Різник із Блавікену",
      position: 0,
      type: "title",
    },
  ],
  appearances: [
    makeBookCharacterView({
      bookId: "book-1",
      roles: [
        {
          customRole: null,
          id: "role-plain",
          isSpoiler: false,
          position: 0,
          roleType: "protagonist",
        },
        {
          customRole: null,
          id: "role-spoiler",
          isSpoiler: true,
          position: 1,
          roleType: "love_interest",
        },
      ],
      speciesOverride: "Мутант",
    }),
  ],
  name: "Ґеральт",
});

describe("toCharacterEditValues spoiler collections", () => {
  it("keeps the spoiler flag of each book role as the server reported it", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");

    expect(values.book.roles).toEqual([
      { customRole: "", isSpoiler: false, roleType: "protagonist" },
      { customRole: "", isSpoiler: true, roleType: "love_interest" },
    ]);
  });

  it("keeps the spoiler flag of a global alias", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");

    expect(values.global.aliases).toEqual([
      { isSpoiler: false, name: "Ґвинблейд", type: "nickname" },
      { isSpoiler: true, name: "Білий Вовк", type: "title" },
    ]);
  });

  it("keeps the spoiler flag of an alias that belongs to the context book", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");

    expect(values.book.aliases).toEqual([
      { isSpoiler: true, name: "Різник із Блавікену", type: "title" },
    ]);
  });
});

describe("toBookUpdate masked collections", () => {
  it("omits the roles key entirely so a save cannot delete a role it was not shown", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");
    const payload = toBookUpdate(values.book, ["roles"]);

    expect(payload).not.toHaveProperty("roles");
    expect(payload).toHaveProperty("speciesOverride", "Мутант");
    expect(payload).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" },
    ]);
  });

  it("omits the aliases key entirely so a save cannot delete an alias it was not shown", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");
    const payload = toBookUpdate(values.book, ["aliases"]);

    expect(payload).not.toHaveProperty("aliases");
    expect(payload).toHaveProperty("roles", [
      { customRole: null, isSpoiler: false, position: 0, roleType: "protagonist" },
      { customRole: null, isSpoiler: true, position: 1, roleType: "love_interest" },
    ]);
  });

  it("sends both collections while nothing is masked", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");
    const payload = toBookUpdate(values.book);

    expect(payload).toHaveProperty("roles");
    expect(payload).toHaveProperty("aliases");
  });
});

describe("toGlobalUpdate masked aliases", () => {
  it("omits the aliases key when the character hides its aliases", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");

    expect(toGlobalUpdate(values.global, ["aliases"])).not.toHaveProperty("aliases");
  });

  it("sends the aliases when nothing is masked", () => {
    const values = toCharacterEditValues(spoilerCharacter, "book-1");

    expect(toGlobalUpdate(values.global)).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Ґвинблейд", position: 0, type: "nickname" },
      { isSpoiler: true, name: "Білий Вовк", position: 1, type: "title" },
    ]);
  });
});

describe("isScopeDirty with masked aliases", () => {
  it("stays clean in the global scope when only a masked alias differs", () => {
    const baseline = toCharacterEditValues(spoilerCharacter, "book-1");
    const current: CharacterEditValues = {
      ...baseline,
      global: {
        ...baseline.global,
        aliases: [{ isSpoiler: false, name: "Мисливець на монстрів", type: "other" }],
      },
    };

    expect(isScopeDirty({ baseline, current, maskedFields: ["aliases"], scope: "global" })).toBe(
      false,
    );
    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(true);
  });
});

describe("maskedEditFields", () => {
  it("adds aliases to the appearance hidden fields when the character hides its aliases", () => {
    expect(
      maskedEditFields({
        appearance: makeBookCharacterView({ hiddenFields: ["roles"] }),
        character: makeCharacterDetails({ hiddenFields: ["aliases"] }),
      }),
    ).toEqual(["roles", "aliases"]);
  });

  it("leaves aliases out while the character does not hide them", () => {
    expect(
      maskedEditFields({
        appearance: makeBookCharacterView({ hiddenFields: ["displayName"] }),
        character: makeCharacterDetails({ hiddenFields: [] }),
      }),
    ).toEqual(["displayName"]);
  });

  it("masks the aliases of a character read without a book context", () => {
    expect(
      maskedEditFields({
        appearance: undefined,
        character: makeCharacterDetails({ hiddenFields: ["aliases"] }),
      }),
    ).toEqual(["aliases"]);
  });
});

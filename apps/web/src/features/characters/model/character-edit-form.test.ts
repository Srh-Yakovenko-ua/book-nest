import type {
  BookCharacterView,
  CharacterRevealFieldKey,
  SpeciesOptionView,
  UpdateBookCharacter,
} from "@app/shared";

import { CHARACTER_ALIASES_MAX } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { BookSpoilerFlag } from "./book-spoiler-flags";
import type { CharacterAliasRow } from "./character-aliases";
import type { CharacterEditValues } from "./character-edit-form";

import {
  buildCharacterEditSchema,
  emptyBookScopeValues,
  isScopeDirty,
  maskedEditFields,
  toBookPatch,
  toBookUpdate,
  toCharacterEditValues,
  toGlobalUpdate,
  withSpeciesChange,
} from "./character-edit-form";
import { resolveInherited } from "./character-inheritance";
import { makeBookCharacterView, makeCharacterDetails, SPECIES_REFS } from "./characters.fixtures";

const character = makeCharacterDetails({
  appearances: [
    makeBookCharacterView({
      attitude: null,
      bookId: "book-1",
      displayName: null,
      speciesOverride: SPECIES_REFS.mutant,
    }),
  ],
  globalAttitude: "like",
  name: "Ґеральт",
  species: SPECIES_REFS.witcher,
});

describe("toCharacterEditValues inheritance state", () => {
  it("reads an absent book value as inherited and a present one as book-specific", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(values.book.displayName).toBeNull();
    expect(values.book.attitude).toBeNull();
    expect(values.book.speciesOverride).toEqual({ id: SPECIES_REFS.mutant.id, label: "Мутант" });
  });

  it("falls back to the empty book scope when the route book has no appearance", () => {
    expect(toCharacterEditValues({ bookId: "book-404", character, locale: "uk" }).book).toEqual(
      emptyBookScopeValues(),
    );
  });
});

describe("toBookUpdate inheritance payload", () => {
  it("sends null for an inherited field and the value for a book-specific one", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(toBookUpdate(values.book)).toMatchObject({
      attitude: null,
      displayName: null,
      speciesOverrideId: SPECIES_REFS.mutant.id,
    });
  });

  it("treats a book-specific but blank value as no book value", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(toBookUpdate({ ...values.book, displayName: "   " })).toMatchObject({
      displayName: null,
    });
  });

  it("omits a masked field so a save cannot wipe what it could not show", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });
    const payload = toBookUpdate(values.book, ["displayName", "portrait", "speciesOverride"]);

    expect(payload).not.toHaveProperty("displayName");
    expect(payload).not.toHaveProperty("portraitMediaId");
    expect(payload).not.toHaveProperty("speciesOverrideId");
    expect(payload).toHaveProperty("attitude", null);
  });
});

describe("isScopeDirty", () => {
  it("ignores a change that maps to the same request", () => {
    const baseline = toCharacterEditValues({
      bookId: "book-1",
      character,
      locale: "uk",
    });
    const current = {
      ...baseline,
      global: { ...baseline.global, name: "  Ґеральт  " },
    };

    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(false);
  });

  it("sees a reset to the global value as a book change", () => {
    const baseline = toCharacterEditValues({
      bookId: "book-1",
      character,
      locale: "uk",
    });
    const current = { ...baseline, book: { ...baseline.book, speciesOverride: null } };

    expect(isScopeDirty({ baseline, current, scope: "book" })).toBe(true);
    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(false);
  });

  it("stays clean for a masked field the form cannot touch", () => {
    const baseline = toCharacterEditValues({
      bookId: "book-1",
      character,
      locale: "uk",
    });
    const current = { ...baseline, book: { ...baseline.book, displayName: "Білий Вовк" } };

    expect(isScopeDirty({ baseline, current, maskedFields: ["displayName"], scope: "book" })).toBe(
      false,
    );
  });
});

describe("toGlobalUpdate", () => {
  it("clears the custom gender unless the gender is custom", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(toGlobalUpdate({ ...values.global, customGender: "Щось" })).toMatchObject({
      customGender: null,
    });
    expect(
      toGlobalUpdate({ ...values.global, customGender: "Щось", gender: "custom" }),
    ).toMatchObject({ customGender: "Щось" });
  });

  it("sends the chosen species as its id and a cleared species as null", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(toGlobalUpdate(values.global)).toHaveProperty("speciesId", SPECIES_REFS.witcher.id);
    expect(toGlobalUpdate({ ...values.global, species: null })).toHaveProperty("speciesId", null);
  });

  it("carries the main avatar and sees a changed one as a global change only", () => {
    const baseline = toCharacterEditValues({
      bookId: "book-1",
      character: {
        ...character,
        avatar: {
          contentType: "image/png",
          createdAt: "2026-06-27T00:00:00.000Z",
          height: 512,
          id: "media-avatar-1",
          kind: "avatar",
          name: "avatar.png",
          sizeBytes: 2048,
          urls: { card: "card.webp", full: "full.webp", thumb: "thumb.webp" },
          width: 512,
        },
      },
      locale: "uk",
    });
    const current = { ...baseline, global: { ...baseline.global, avatarMediaId: null } };

    expect(toGlobalUpdate(baseline.global)).toHaveProperty("avatarMediaId", "media-avatar-1");
    expect(toGlobalUpdate(current.global)).toHaveProperty("avatarMediaId", null);
    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(true);
    expect(isScopeDirty({ baseline, current, scope: "book" })).toBe(false);
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
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(toBookUpdate({ ...values.book, firstAppearanceChapter: "Пролог" })).toMatchObject({
      firstAppearanceChapter: "Пролог",
      firstAppearancePage: null,
    });
  });

  it("sends the page as a number and an empty page as null", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    expect(toBookUpdate({ ...values.book, firstAppearancePage: 47 })).toMatchObject({
      firstAppearancePage: 47,
    });
    expect(toBookUpdate({ ...values.book, firstAppearancePage: null })).toMatchObject({
      firstAppearancePage: null,
    });
  });

  it("does not require one first-appearance field because another is filled", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

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
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

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
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });
    const pov = { ...values.book, isPovCharacter: true, narratorType: "first_person" } as const;

    expect(toBookUpdate(pov)).toMatchObject({ isPovCharacter: true, narratorType: "first_person" });
    expect(toBookUpdate({ ...pov, isPovCharacter: false })).toMatchObject({
      isPovCharacter: false,
      narratorType: null,
    });
  });

  it("leaves the point-of-view group out of a patch that does not change it, so a legacy unreliable narrator without POV keeps its flag", () => {
    const legacy = toCharacterEditValues({
      bookId: "book-1",
      character: makeCharacterDetails({
        appearances: [
          makeBookCharacterView({
            bookId: "book-1",
            isPovCharacter: false,
            isUnreliableNarrator: true,
          }),
        ],
      }),
      locale: "uk",
    });

    const patch = toBookPatch({
      baseline: legacy.book,
      current: { ...legacy.book, firstAppearanceChapter: "Розділ 3" },
      maskedFields: [],
    });

    expect(patch).toMatchObject({ firstAppearanceChapter: "Розділ 3" });
    expect(patch).not.toHaveProperty("isPovCharacter");
    expect(patch).not.toHaveProperty("narratorType");
    expect(patch).not.toHaveProperty("isUnreliableNarrator");
    expect(patch).not.toHaveProperty("isUnreliableNarratorSpoiler");
  });

  it("sends a cleared narration and reliability once the point of view is turned off", () => {
    const narrator = toCharacterEditValues({
      bookId: "book-1",
      character: makeCharacterDetails({
        appearances: [
          makeBookCharacterView({
            bookId: "book-1",
            isPovCharacter: true,
            isUnreliableNarrator: true,
            isUnreliableNarratorSpoiler: true,
            narratorType: "first_person",
          }),
        ],
      }),
      locale: "uk",
    });

    expect(
      toBookPatch({
        baseline: narrator.book,
        current: { ...narrator.book, isPovCharacter: false },
        maskedFields: [],
      }),
    ).toMatchObject({
      isPovCharacter: false,
      isUnreliableNarrator: false,
      isUnreliableNarratorSpoiler: false,
      narratorType: null,
    });
  });

  it("never sends the unreliable narrator flags while the server masks them", () => {
    const appearance = makeBookCharacterView({
      bookId: "book-1",
      hiddenFields: ["unreliableNarrator"],
      isPovCharacter: true,
      isUnreliableNarrator: null,
      isUnreliableNarratorSpoiler: true,
      narratorType: "first_person",
    });
    const masked = toCharacterEditValues({
      bookId: "book-1",
      character: makeCharacterDetails({ appearances: [appearance] }),
      locale: "uk",
    });

    const patch = toBookPatch({
      baseline: masked.book,
      current: {
        ...masked.book,
        isUnreliableNarrator: true,
        narratorType: "third_person_limited",
      },
      maskedFields: maskedEditFields({ appearance, character: makeCharacterDetails() }),
    });

    expect(patch).toMatchObject({ isPovCharacter: true, narratorType: "third_person_limited" });
    expect(patch).not.toHaveProperty("isUnreliableNarrator");
    expect(patch).not.toHaveProperty("isUnreliableNarratorSpoiler");
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
      speciesOverride: SPECIES_REFS.mutant,
    }),
  ],
  name: "Ґеральт",
});

describe("toCharacterEditValues spoiler collections", () => {
  it("keeps the spoiler flag of each book role as the server reported it", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(values.book.roles).toEqual([
      { customRole: "", isSpoiler: false, roleType: "protagonist" },
      { customRole: "", isSpoiler: true, roleType: "love_interest" },
    ]);
  });

  it("keeps the spoiler flag of a global alias", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(values.global.aliases).toEqual([
      { isSpoiler: false, name: "Ґвинблейд", type: "nickname" },
      { isSpoiler: true, name: "Білий Вовк", type: "title" },
    ]);
  });

  it("keeps the spoiler flag of an alias that belongs to the context book", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(values.book.aliases).toEqual([
      { isSpoiler: true, name: "Різник із Блавікену", type: "title" },
    ]);
  });
});

describe("toBookUpdate masked collections", () => {
  it("omits the roles key entirely so a save cannot delete a role it was not shown", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });
    const payload = toBookUpdate(values.book, ["roles"]);

    expect(payload).not.toHaveProperty("roles");
    expect(payload).toHaveProperty("speciesOverrideId", SPECIES_REFS.mutant.id);
    expect(payload).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" },
    ]);
  });

  it("omits the aliases key entirely so a save cannot delete an alias it was not shown", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });
    const payload = toBookUpdate(values.book, ["bookAliases"]);

    expect(payload).not.toHaveProperty("aliases");
    expect(payload).toHaveProperty("roles", [
      { customRole: null, isSpoiler: false, position: 0, roleType: "protagonist" },
      { customRole: null, isSpoiler: true, position: 1, roleType: "love_interest" },
    ]);
  });

  it("keeps the book aliases when only the global aliases are masked", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(toBookUpdate(values.book, ["globalAliases"])).toHaveProperty("aliases", [
      { isSpoiler: true, name: "Різник із Блавікену", position: 0, type: "title" },
    ]);
  });

  it("sends both collections while nothing is masked", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });
    const payload = toBookUpdate(values.book);

    expect(payload).toHaveProperty("roles");
    expect(payload).toHaveProperty("aliases");
  });
});

describe("toGlobalUpdate masked aliases", () => {
  it("omits the aliases key when the character hides its aliases", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(toGlobalUpdate(values.global, ["globalAliases"])).not.toHaveProperty("aliases");
  });

  it("keeps the global aliases when only the book aliases are masked", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(toGlobalUpdate(values.global, ["bookAliases"])).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Ґвинблейд", position: 0, type: "nickname" },
      { isSpoiler: true, name: "Білий Вовк", position: 1, type: "title" },
    ]);
  });

  it("sends the aliases when nothing is masked", () => {
    const values = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });

    expect(toGlobalUpdate(values.global)).toHaveProperty("aliases", [
      { isSpoiler: false, name: "Ґвинблейд", position: 0, type: "nickname" },
      { isSpoiler: true, name: "Білий Вовк", position: 1, type: "title" },
    ]);
  });
});

describe("isScopeDirty with masked aliases", () => {
  it("stays clean in the global scope when only a masked alias differs", () => {
    const baseline = toCharacterEditValues({
      bookId: "book-1",
      character: spoilerCharacter,
      locale: "uk",
    });
    const current: CharacterEditValues = {
      ...baseline,
      global: {
        ...baseline.global,
        aliases: [{ isSpoiler: false, name: "Мисливець на монстрів", type: "other" }],
      },
    };

    expect(
      isScopeDirty({ baseline, current, maskedFields: ["globalAliases"], scope: "global" }),
    ).toBe(false);
    expect(isScopeDirty({ baseline, current, scope: "global" })).toBe(true);
  });
});

describe("maskedEditFields", () => {
  it("adds both alias groups to the appearance hidden fields when the character hides them", () => {
    expect(
      maskedEditFields({
        appearance: makeBookCharacterView({ hiddenFields: ["roles"] }),
        character: makeCharacterDetails({ hiddenFields: ["globalAliases", "bookAliases"] }),
      }),
    ).toEqual(["roles", "globalAliases", "bookAliases"]);
  });

  it("leaves the alias groups out while the character does not hide them", () => {
    expect(
      maskedEditFields({
        appearance: makeBookCharacterView({ hiddenFields: ["displayName"] }),
        character: makeCharacterDetails({ hiddenFields: [] }),
      }),
    ).toEqual(["displayName"]);
  });

  it("takes only the alias groups from the character and never another book field", () => {
    expect(
      maskedEditFields({
        appearance: makeBookCharacterView({ hiddenFields: [] }),
        character: makeCharacterDetails({
          hiddenFields: ["description", "status", "bookAliases", "roles"],
        }),
      }),
    ).toEqual(["bookAliases"]);
  });

  it("masks the global aliases of a character read without a book context", () => {
    expect(
      maskedEditFields({
        appearance: undefined,
        character: makeCharacterDetails({ hiddenFields: ["globalAliases"] }),
      }),
    ).toEqual(["globalAliases"]);
  });
});

const spoilerFlags = (isOn: boolean): Record<BookSpoilerFlag, boolean> => ({
  appearanceNotesIsSpoiler: isOn,
  descriptionIsSpoiler: isOn,
  displayNameIsSpoiler: isOn,
  personalImpressionIsSpoiler: isOn,
  portraitIsSpoiler: isOn,
  speciesOverrideIsSpoiler: isOn,
  statusIsSpoiler: isOn,
});

const spoilerPortrait = {
  contentType: "image/png",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 512,
  id: "media-portrait-1",
  kind: "avatar",
  name: "portrait.png",
  sizeBytes: 2048,
  urls: { card: "card.webp", full: "full.webp", thumb: "thumb.webp" },
  width: 512,
} as const;

function editValuesOf(appearance: Partial<BookCharacterView>): CharacterEditValues["book"] {
  return toCharacterEditValues({
    bookId: "book-1",
    character: makeCharacterDetails({
      appearances: [makeBookCharacterView({ bookId: "book-1", ...appearance })],
    }),
    locale: "uk",
  }).book;
}

const filledSpoilerAppearance: Partial<BookCharacterView> = {
  ...spoilerFlags(true),
  appearanceNotes: "Шрам через ліве око",
  description: "Мутант, що полює на чудовиськ",
  displayName: "Білий Вовк",
  personalImpression: "Похмурий, але чесний",
  portrait: spoilerPortrait,
  speciesOverride: SPECIES_REFS.mutant,
  status: "dead",
};

describe("spoiler flags follow their values", () => {
  it("keeps every spoiler flag whose value is filled", () => {
    expect(editValuesOf(filledSpoilerAppearance)).toMatchObject(spoilerFlags(true));
  });

  it("loads a stale spoiler flag over an empty value as off for every field", () => {
    const stale = editValuesOf({
      ...spoilerFlags(true),
      appearanceNotes: "   ",
      description: null,
      displayName: " ",
      personalImpression: "",
      portrait: null,
      speciesOverride: null,
      status: null,
    });

    expect(stale).toMatchObject(spoilerFlags(false));
  });

  it.each<{ empty: Partial<CharacterEditValues["book"]>; flag: BookSpoilerFlag; label: string }>([
    { empty: { displayName: null }, flag: "displayNameIsSpoiler", label: "an inherited name" },
    { empty: { displayName: "   " }, flag: "displayNameIsSpoiler", label: "a blank name" },
    { empty: { portraitMediaId: null }, flag: "portraitIsSpoiler", label: "a removed portrait" },
    { empty: { status: "not_specified" }, flag: "statusIsSpoiler", label: "an unset status" },
    { empty: { speciesOverride: null }, flag: "speciesOverrideIsSpoiler", label: "no species" },
    { empty: { description: "  " }, flag: "descriptionIsSpoiler", label: "a blank description" },
    {
      empty: { personalImpression: "" },
      flag: "personalImpressionIsSpoiler",
      label: "an empty impression",
    },
    {
      empty: { appearanceNotes: "\n " },
      flag: "appearanceNotesIsSpoiler",
      label: "blank appearance notes",
    },
  ])("sends $flag as false for $label even while the form still holds it on", ({ empty, flag }) => {
    const filled = editValuesOf(filledSpoilerAppearance);

    expect(toBookUpdate(filled)).toHaveProperty(flag, true);
    expect(toBookUpdate({ ...filled, ...empty })).toHaveProperty(flag, false);
  });

  it("keeps the status spoiler flag for an unknown status and drops it for an unset one", () => {
    const filled = editValuesOf(filledSpoilerAppearance);

    expect(toBookUpdate({ ...filled, status: "unknown" })).toHaveProperty("statusIsSpoiler", true);
    expect(toBookUpdate({ ...filled, status: "not_specified" })).toHaveProperty(
      "statusIsSpoiler",
      false,
    );
  });
});

describe("toBookUpdate masked spoiler fields", () => {
  it.each<{
    masked: Partial<BookCharacterView>;
    payloadKeys: (keyof UpdateBookCharacter)[];
    revealKey: CharacterRevealFieldKey;
  }>([
    {
      masked: { displayName: null },
      payloadKeys: ["displayName", "displayNameIsSpoiler"],
      revealKey: "displayName",
    },
    {
      masked: { portrait: null },
      payloadKeys: ["portraitMediaId", "portraitIsSpoiler"],
      revealKey: "portrait",
    },
    {
      masked: { status: null, statusCustomText: null },
      payloadKeys: ["status", "statusCustomText", "statusIsSpoiler"],
      revealKey: "status",
    },
    {
      masked: { speciesOverride: null },
      payloadKeys: ["speciesOverrideId", "speciesOverrideIsSpoiler"],
      revealKey: "speciesOverride",
    },
    {
      masked: { description: null },
      payloadKeys: ["description", "descriptionIsSpoiler"],
      revealKey: "description",
    },
    {
      masked: { personalImpression: null },
      payloadKeys: ["personalImpression", "personalImpressionIsSpoiler"],
      revealKey: "personalImpression",
    },
    {
      masked: { appearanceNotes: null },
      payloadKeys: ["appearanceNotes", "appearanceNotesIsSpoiler"],
      revealKey: "appearanceNotes",
    },
  ])(
    "sends neither the value nor the flag of a masked $revealKey",
    ({ masked, payloadKeys, revealKey }) => {
      const appearance = makeBookCharacterView({
        ...filledSpoilerAppearance,
        ...masked,
        bookId: "book-1",
        hiddenFields: [revealKey],
      });
      const maskedCharacter = makeCharacterDetails({ appearances: [appearance] });
      const values = toCharacterEditValues({
        bookId: "book-1",
        character: maskedCharacter,
        locale: "uk",
      });

      const payload = toBookUpdate(
        values.book,
        maskedEditFields({ appearance, character: maskedCharacter }),
      );

      for (const key of payloadKeys) {
        expect(payload).not.toHaveProperty(key);
      }
      expect(payload).toHaveProperty("importance");
    },
  );

  it("loads the flag of a masked field as it is stored instead of switching it off", () => {
    const masked = editValuesOf({
      ...spoilerFlags(true),
      appearanceNotes: null,
      description: null,
      displayName: null,
      hiddenFields: [
        "appearanceNotes",
        "description",
        "displayName",
        "personalImpression",
        "portrait",
        "speciesOverride",
        "status",
      ],
      personalImpression: null,
      portrait: null,
      speciesOverride: null,
      status: null,
    });

    expect(masked).toMatchObject(spoilerFlags(true));
  });
});

describe("withSpeciesChange", () => {
  const human: SpeciesOptionView = {
    category: null,
    id: "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6",
    isOwn: false,
    key: "human",
    name: "Людина",
  };

  it("moves both species fields off a species merged into another one", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });
    const sharedSpecies = {
      ...values,
      book: { ...values.book, speciesOverride: values.global.species },
    };

    const next = withSpeciesChange(sharedSpecies, {
      kind: "merged",
      sourceId: SPECIES_REFS.witcher.id,
      target: human,
    });

    expect(next.global.species).toEqual({ id: human.id, label: "Людина" });
    expect(next.book.speciesOverride).toEqual({ id: human.id, label: "Людина" });
  });

  it("clears only the field that held a deleted species", () => {
    const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

    const next = withSpeciesChange(values, { kind: "deleted", speciesId: SPECIES_REFS.mutant.id });

    expect(next.book.speciesOverride).toBeNull();
    expect(next.global.species).toEqual({ id: SPECIES_REFS.witcher.id, label: "Відьмак" });
  });
});

describe("buildCharacterEditSchema aliases", () => {
  const schema = buildCharacterEditSchema(
    {
      aliasDuplicate: "duplicate",
      aliasReservedBook: "reserved-book",
      aliasReservedGlobal: "reserved-global",
      customGenderRequired: "custom-gender-required",
      firstAppearancePageExceedsBook: "page-exceeds-book",
      firstAppearancePageInvalid: "page-invalid",
      nameRequired: "name-required",
      nameTooLong: "name-too-long",
      textTooLong: (max) => `too-long-${max}`,
    },
    { max: 300, source: "book" },
  );
  const values = toCharacterEditValues({ bookId: "book-1", character, locale: "uk" });

  function globalAliasIssues(aliases: CharacterAliasRow[]) {
    const result = schema.safeParse({ ...values, global: { ...values.global, aliases } });
    if (result.success) return [];
    return result.error.issues
      .filter((issue) => issue.path[0] === "global" && issue.path[1] === "aliases")
      .map((issue) => ({ code: issue.code, message: issue.message, path: issue.path.join(".") }));
  }

  it("accepts one name under two types but flags a repeat of the same name and type", () => {
    expect(
      globalAliasIssues([
        { isSpoiler: false, name: "Білий Вовк", type: "nickname" },
        { isSpoiler: false, name: "Білий Вовк", type: "title" },
        { isSpoiler: false, name: "білий  вовк", type: "nickname" },
      ]),
    ).toEqual([{ code: "custom", message: "duplicate", path: "global.aliases.2.name" }]);
  });

  it("flags an alias that repeats the main name", () => {
    expect(globalAliasIssues([{ isSpoiler: false, name: "ґеральт", type: "true_name" }])).toEqual([
      { code: "custom", message: "reserved-global", path: "global.aliases.0.name" },
    ]);
  });

  it("leaves the alias cap to the API so a scope already over it can still be saved", () => {
    const overLimit = Array.from({ length: CHARACTER_ALIASES_MAX + 5 }, (_unused, index) => ({
      isSpoiler: false,
      name: `Ім’я ${index}`,
      type: "other" as const,
    }));

    expect(globalAliasIssues(overLimit)).toEqual([]);
  });

  it("reserves the global name for book aliases once the book name override is cleared", () => {
    const result = schema.safeParse({
      ...values,
      book: {
        ...values.book,
        aliases: [{ isSpoiler: false, name: "ґеральт", type: "other" }],
        displayName: "  ",
      },
    });

    expect(result.success ? [] : result.error.issues).toEqual([
      expect.objectContaining({ message: "reserved-book", path: ["book", "aliases", 0, "name"] }),
    ]);
  });
});

import type {
  BundleAppearance,
  BundleCharacter,
  BundleGroup,
  BundleRelationship,
  BundleTheory,
  CharacterBundle,
} from "@app/shared";

import { CharacterBundleSchema } from "@app/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { CharacterExportSource, OwnedLibraryRefs } from "./character-portability.js";

import {
  classifyBundleParseError,
  planCharacterImport,
  serializeCharacterBundle,
} from "./character-portability.js";

const CHAR_A = "11111111-1111-4111-8111-111111111111";
const CHAR_B = "22222222-2222-4222-8222-222222222222";
const BOOK_OWNED = "33333333-3333-4333-8333-333333333333";
const BOOK_MISSING = "44444444-4444-4444-8444-444444444444";
const TAG_OWNED = "55555555-5555-4555-8555-555555555555";
const TAG_MISSING = "66666666-6666-4666-8666-666666666666";
const MEDIA_MISSING = "77777777-7777-4777-8777-777777777777";
const SERIES_MISSING = "88888888-8888-4888-8888-888888888888";
const USER_ID = "99999999-9999-4999-8999-999999999999";

function idFactory(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `fresh-${counter}`;
  };
}

function makeAppearance(overrides: Partial<BundleAppearance> = {}): BundleAppearance {
  return {
    appearanceNotes: null,
    appearanceNotesIsSpoiler: false,
    attitude: null,
    bookId: BOOK_OWNED,
    description: null,
    descriptionIsSpoiler: false,
    displayName: null,
    displayNameIsSpoiler: false,
    firstAppearanceAudioSeconds: null,
    firstAppearanceChapter: null,
    firstAppearanceNote: null,
    firstAppearancePage: null,
    hidePresenceAsSpoiler: false,
    importance: "supporting",
    isPovCharacter: false,
    narratorType: null,
    personalImpression: null,
    personalImpressionIsSpoiler: false,
    portraitIsSpoiler: false,
    portraitMediaId: null,
    roles: [],
    sortOrder: null,
    speciesOverride: null,
    speciesOverrideIsSpoiler: false,
    status: "active",
    statusCustomText: null,
    statusIsSpoiler: false,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<CharacterBundle> = {}): CharacterBundle {
  return {
    characters: [],
    exportedAt: "2026-01-01T00:00:00.000Z",
    formatVersion: 1,
    groups: [],
    relationships: [],
    theories: [],
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<BundleCharacter> = {}): BundleCharacter {
  return {
    aliases: [],
    appearances: [],
    avatarMediaId: null,
    customGender: null,
    entityKind: "individual",
    gender: "unknown",
    globalAttitude: null,
    id: CHAR_A,
    isArchived: false,
    isFavorite: false,
    name: "Paul",
    neutralDescription: null,
    pronouns: null,
    species: null,
    tagIds: [],
    ...overrides,
  };
}

function makeGroup(overrides: Partial<BundleGroup> = {}): BundleGroup {
  return {
    customType: null,
    description: null,
    isSpoiler: false,
    memberships: [],
    name: "House Atreides",
    seriesId: null,
    type: "house",
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<BundleRelationship> = {}): BundleRelationship {
  return {
    bookStates: [],
    category: "social",
    customType: null,
    directionality: "symmetric",
    isCanonical: false,
    sourceCharacterId: CHAR_A,
    sourceLabel: null,
    targetCharacterId: CHAR_B,
    targetLabel: null,
    type: "friend_of",
    ...overrides,
  };
}

function makeTheory(overrides: Partial<BundleTheory> = {}): BundleTheory {
  return {
    bookId: null,
    characterId: CHAR_A,
    isSpoiler: false,
    seriesId: null,
    status: "unverified",
    text: "A theory",
    ...overrides,
  };
}

const owned: OwnedLibraryRefs = {
  bookIds: new Set([BOOK_OWNED]),
  mediaIds: new Set(),
  seriesIds: new Set(),
  tagIds: new Set([TAG_OWNED]),
};

describe("planCharacterImport", () => {
  it("remaps ids, stamps ownership, re-links owned refs and skips unowned refs", () => {
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          aliases: [
            { bookId: null, isSpoiler: false, name: "Muad'Dib", position: 0, type: "nickname" },
            { bookId: BOOK_MISSING, isSpoiler: false, name: "Usul", position: 1, type: "nickname" },
          ],
          appearances: [
            makeAppearance({
              bookId: BOOK_OWNED,
              roles: [
                { customRole: null, isSpoiler: false, position: 0, roleType: "protagonist" },
                { customRole: null, isSpoiler: false, position: 1, roleType: "protagonist" },
              ],
            }),
            makeAppearance({ bookId: BOOK_MISSING }),
          ],
          avatarMediaId: MEDIA_MISSING,
          id: CHAR_A,
          name: "Paul",
          tagIds: [TAG_OWNED, TAG_MISSING],
        }),
        makeCharacter({ id: CHAR_B, name: "Chani" }),
      ],
      groups: [
        makeGroup({
          memberships: [
            { bookId: null, characterId: CHAR_A, isSpoiler: false, role: null, status: null },
            {
              bookId: BOOK_MISSING,
              characterId: CHAR_B,
              isSpoiler: false,
              role: null,
              status: null,
            },
          ],
          seriesId: SERIES_MISSING,
        }),
      ],
      relationships: [
        makeRelationship({ sourceCharacterId: CHAR_A, targetCharacterId: CHAR_B }),
        makeRelationship({ sourceCharacterId: CHAR_A, targetCharacterId: CHAR_B }),
        makeRelationship({ sourceCharacterId: CHAR_A, targetCharacterId: CHAR_A }),
      ],
      theories: [
        makeTheory({ characterId: CHAR_A }),
        makeTheory({ bookId: BOOK_MISSING, characterId: null, seriesId: null }),
        makeTheory({ bookId: BOOK_OWNED, characterId: null }),
      ],
    });

    const plan = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: new Date(),
      owned,
      userId: USER_ID,
    });

    expect(plan.created).toEqual({
      aliases: 1,
      appearances: 1,
      bookStates: 0,
      characters: 2,
      groups: 1,
      memberships: 1,
      relationships: 1,
      roles: 1,
      tags: 1,
      theories: 2,
    });
    expect(plan.skipped).toEqual({
      aliasesMissingBook: 1,
      appearancesMissingBook: 1,
      bookStatesMissingBook: 0,
      membershipsMissingBook: 1,
      relationshipsInvalid: 2,
      tagsMissing: 1,
      theoriesWithoutTarget: 1,
      unlinkedMedia: 1,
      unlinkedSeries: 1,
    });

    for (const row of plan.characters) {
      expect(row.userId).toBe(USER_ID);
      expect(row.id).not.toBe(CHAR_A);
      expect(row.id).not.toBe(CHAR_B);
    }
    expect(plan.characters[0]?.avatarMediaId).toBeNull();
    expect(plan.groups[0]?.userId).toBe(USER_ID);
    expect(plan.groups[0]?.seriesId).toBeNull();
    expect(plan.relationships[0]?.userId).toBe(USER_ID);

    const freshA = plan.characters[0]?.id;
    const freshB = plan.characters[1]?.id;
    expect(plan.memberships[0]?.characterId).toBe(freshA);
    const relationship = plan.relationships[0];
    expect([relationship?.sourceCharacterId, relationship?.targetCharacterId].sort()).toEqual(
      [freshA, freshB].sort(),
    );
    expect(plan.theories.every((theory) => theory.userId === USER_ID)).toBe(true);
    const theoryTargets = plan.theories.map((theory) => theory.characterId);
    expect(theoryTargets).toContain(freshA);
  });

  it("re-links owned book, media, series and tag references", () => {
    const relinkOwned: OwnedLibraryRefs = {
      bookIds: new Set([BOOK_OWNED]),
      mediaIds: new Set([MEDIA_MISSING]),
      seriesIds: new Set([SERIES_MISSING]),
      tagIds: new Set([TAG_OWNED]),
    };
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          appearances: [makeAppearance({ bookId: BOOK_OWNED, portraitMediaId: MEDIA_MISSING })],
          avatarMediaId: MEDIA_MISSING,
          id: CHAR_A,
          tagIds: [TAG_OWNED],
        }),
      ],
      groups: [makeGroup({ seriesId: SERIES_MISSING })],
    });

    const plan = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: new Date(),
      owned: relinkOwned,
      userId: USER_ID,
    });

    expect(plan.characters[0]?.avatarMediaId).toBe(MEDIA_MISSING);
    expect(plan.bookCharacters[0]?.portraitMediaId).toBe(MEDIA_MISSING);
    expect(plan.groups[0]?.seriesId).toBe(SERIES_MISSING);
    expect(plan.characterTags[0]?.tagId).toBe(TAG_OWNED);
    expect(plan.skipped.unlinkedMedia).toBe(0);
    expect(plan.skipped.unlinkedSeries).toBe(0);
    expect(plan.skipped.tagsMissing).toBe(0);
  });
});

describe("serializeCharacterBundle", () => {
  it("derives the archived flag and stamps the format version", () => {
    const source: CharacterExportSource = {
      characters: [
        {
          aliases: [
            { bookId: null, isSpoiler: false, name: "Muad'Dib", position: 0, type: "nickname" },
          ],
          archivedAt: new Date("2026-01-02T00:00:00.000Z"),
          avatarMediaId: null,
          bookAppearances: [],
          customGender: null,
          entityKind: "individual",
          gender: "male",
          globalAttitude: "favorite",
          id: CHAR_A,
          isFavorite: true,
          name: "Paul",
          neutralDescription: null,
          pronouns: null,
          species: null,
          tags: [{ tagId: TAG_OWNED }],
        },
      ],
      groups: [],
      relationships: [],
      theories: [],
    };

    const bundle = serializeCharacterBundle({
      exportedAt: new Date("2026-01-03T00:00:00.000Z"),
      source,
    });

    expect(bundle.formatVersion).toBe(1);
    expect(bundle.exportedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(bundle.characters[0]?.isArchived).toBe(true);
    expect(bundle.characters[0]?.tagIds).toEqual([TAG_OWNED]);
    expect(CharacterBundleSchema.safeParse(bundle).success).toBe(true);
  });
});

describe("classifyBundleParseError", () => {
  it("flags a collection overflow as too large", () => {
    const result = z.array(z.number()).max(1).safeParse([1, 2, 3]);
    if (result.success) {
      throw new Error("expected the parse to fail");
    }
    expect(classifyBundleParseError(result.error)).toBe("tooLarge");
  });

  it("flags a shape mismatch as invalid", () => {
    const result = z.object({ a: z.string() }).safeParse({});
    if (result.success) {
      throw new Error("expected the parse to fail");
    }
    expect(classifyBundleParseError(result.error)).toBe("invalid");
  });
});

describe("CharacterBundleSchema", () => {
  it("rejects an injected ownership field on a character", () => {
    const bundle = makeBundle({ characters: [makeCharacter({ id: CHAR_A })] });
    const hostile = {
      ...bundle,
      characters: [{ ...bundle.characters[0], userId: USER_ID }],
    };
    expect(CharacterBundleSchema.safeParse(hostile).success).toBe(false);
  });

  it("rejects a relationship that references a character outside the bundle", () => {
    const bundle = makeBundle({
      characters: [makeCharacter({ id: CHAR_A })],
      relationships: [makeRelationship({ sourceCharacterId: CHAR_A, targetCharacterId: CHAR_B })],
    });
    expect(CharacterBundleSchema.safeParse(bundle).success).toBe(false);
  });
});

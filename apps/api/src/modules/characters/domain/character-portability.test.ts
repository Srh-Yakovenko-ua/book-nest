import type {
  BundleAppearance,
  BundleCharacter,
  BundleFact,
  BundleGroup,
  BundleRelationship,
  BundleTheory,
  CharacterBundle,
  Nullable,
} from "@app/shared";

import {
  CharacterBundleImportSchema,
  CharacterBundleSchema,
  upgradeLegacyCharacterBundle,
} from "@app/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { CharacterExportSource, OwnedLibraryRefs } from "./character-portability.js";

import {
  classifyBundleParseError,
  importDraftSpeciesRefs,
  linkImportDraftSpecies,
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
    facts: [],
    firstAppearanceAudioSeconds: null,
    firstAppearanceChapter: null,
    firstAppearanceNote: null,
    firstAppearancePage: null,
    importance: "supporting",
    isPovCharacter: false,
    isUnreliableNarrator: false,
    isUnreliableNarratorSpoiler: false,
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
    formatVersion: 2,
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
    forms: [],
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

function makeFact(overrides: Partial<BundleFact> = {}): BundleFact {
  return {
    chapter: "Book One",
    createdAt: "2025-03-04T05:06:07.890Z",
    page: 42,
    text: "Survived the gom jabbar",
    title: "The test",
    updatedAt: "2025-04-05T06:07:08.901Z",
    ...overrides,
  };
}

function makeFacts(count: number): BundleFact[] {
  return Array.from({ length: count }, (_unused, index) => makeFact({ title: `Fact ${index}` }));
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

function toV1Bundle(bundle: CharacterBundle): Record<string, unknown> {
  return {
    ...bundle,
    characters: bundle.characters.map((character) => ({
      ...character,
      appearances: character.appearances.map(({ facts: _facts, ...appearance }) => appearance),
    })),
    formatVersion: 1,
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
          forms: [
            {
              description: null,
              formType: "true_form",
              isSpoiler: true,
              name: "True Form",
              portraitMediaId: null,
              position: 0,
            },
            {
              description: null,
              formType: "other",
              isSpoiler: false,
              name: "true form",
              portraitMediaId: null,
              position: 1,
            },
          ],
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
      facts: 0,
      forms: 1,
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
      factsMissingBook: 0,
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

    expect(plan.forms).toHaveLength(1);
    expect(plan.forms[0]?.characterId).toBe(freshA);
    expect(plan.forms[0]?.id).not.toBe(CHAR_A);
    expect(plan.forms[0]).toMatchObject({
      isSpoiler: true,
      name: "True Form",
      normalizedName: "true form",
    });
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
          forms: [
            {
              description: null,
              formType: "reincarnation",
              isSpoiler: false,
              name: "Reborn",
              portraitMediaId: MEDIA_MISSING,
              position: 0,
            },
          ],
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
    expect(plan.forms[0]?.portraitMediaId).toBe(MEDIA_MISSING);
    expect(plan.groups[0]?.seriesId).toBe(SERIES_MISSING);
    expect(plan.characterTags[0]?.tagId).toBe(TAG_OWNED);
    expect(plan.skipped.unlinkedMedia).toBe(0);
    expect(plan.skipped.unlinkedSeries).toBe(0);
    expect(plan.skipped.tagsMissing).toBe(0);
  });
});

describe("portable species references", () => {
  const SYSTEM_ELF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const OWN_SPECIES_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("keeps the character ref and the refs of owned, first-per-book appearances only", () => {
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          appearances: [
            makeAppearance({ speciesOverride: "Sylvan", speciesOverrideKey: null }),
            makeAppearance({ speciesOverride: "Duplicate" }),
            makeAppearance({ bookId: BOOK_MISSING, speciesOverride: "Unlinked" }),
          ],
          species: "Elf",
          speciesKey: "elf",
        }),
        makeCharacter({ id: CHAR_B, species: "Legacy text" }),
      ],
    });

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: new Date(),
      owned,
      userId: USER_ID,
    });

    expect(importDraftSpeciesRefs(draft)).toEqual([
      { key: "elf", name: "Elf" },
      { key: null, name: "Legacy text" },
      { key: null, name: "Sylvan" },
    ]);
  });

  it("writes the resolved species ids and keeps the override spoiler flag", () => {
    const resolvedIds = new Map([
      ["elf", SYSTEM_ELF_ID],
      ["Sylvan", OWN_SPECIES_ID],
    ]);
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          appearances: [
            makeAppearance({ speciesOverride: "Sylvan", speciesOverrideIsSpoiler: true }),
          ],
          species: "Elf",
          speciesKey: "elf",
        }),
      ],
    });

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: new Date(),
      owned,
      userId: USER_ID,
    });
    const plan = linkImportDraftSpecies({
      draft,
      resolveSpeciesId: (ref) => resolvedIds.get(ref.key ?? ref.name ?? "") ?? null,
    });

    expect(plan.characters[0]?.speciesId).toBe(SYSTEM_ELF_ID);
    expect(plan.characters[0]).not.toHaveProperty("speciesRef");
    expect(plan.bookCharacters[0]).not.toHaveProperty("speciesOverrideRef");
    expect(plan.bookCharacters[0]).toMatchObject({
      speciesOverrideId: OWN_SPECIES_ID,
      speciesOverrideIsSpoiler: true,
    });
  });

  it("exports a system species as key plus name and a custom one as name only", () => {
    const source: CharacterExportSource = {
      characters: [
        {
          aliases: [],
          archivedAt: null,
          avatarMediaId: null,
          bookAppearances: [
            {
              ...makeAppearance(),
              facts: [],
              roles: [],
              speciesOverride: { key: null, name: "Sylvan" },
              speciesOverrideIsSpoiler: true,
            },
          ],
          customGender: null,
          entityKind: "individual",
          forms: [],
          gender: "unknown",
          globalAttitude: null,
          id: CHAR_A,
          isFavorite: false,
          name: "Legolas",
          neutralDescription: null,
          pronouns: null,
          species: { key: "elf", name: "Elf" },
          tags: [],
        },
      ],
      groups: [],
      relationships: [],
      theories: [],
    };

    const bundle = serializeCharacterBundle({ exportedAt: new Date(), source });

    expect(bundle.characters[0]).toMatchObject({ species: "Elf", speciesKey: "elf" });
    expect(bundle.characters[0]?.appearances[0]).toMatchObject({
      speciesOverride: "Sylvan",
      speciesOverrideIsSpoiler: true,
      speciesOverrideKey: null,
    });
    expect(CharacterBundleSchema.safeParse(bundle).success).toBe(true);
  });

  it("still parses a version 1 bundle that carries species text without keys", () => {
    const legacyCharacter = makeCharacter({
      appearances: [makeAppearance({ speciesOverride: "Fremen" })],
      species: "Human",
    });

    expect(legacyCharacter).not.toHaveProperty("speciesKey");
    expect(
      CharacterBundleSchema.safeParse(makeBundle({ characters: [legacyCharacter] })).success,
    ).toBe(true);
    const imported = CharacterBundleImportSchema.safeParse(
      toV1Bundle(makeBundle({ characters: [legacyCharacter] })),
    );
    expect(imported.success).toBe(true);
    expect(imported.data?.sourceFormatVersion).toBe(1);
    expect(imported.data?.bundle.characters[0]).toMatchObject({ species: "Human" });
    expect(imported.data?.bundle.characters[0]?.appearances[0]).toMatchObject({
      facts: [],
      speciesOverride: "Fremen",
    });
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
          forms: [
            {
              description: "The revealed self",
              formType: "true_form",
              isSpoiler: true,
              name: "True Form",
              portraitMediaId: null,
              position: 0,
            },
          ],
          gender: "male",
          globalAttitude: "like",
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

    expect(bundle.formatVersion).toBe(2);
    expect(bundle.exportedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(bundle.characters[0]?.isArchived).toBe(true);
    expect(bundle.characters[0]?.tagIds).toEqual([TAG_OWNED]);
    expect(bundle.characters[0]?.forms).toEqual([
      {
        description: "The revealed self",
        formType: "true_form",
        isSpoiler: true,
        name: "True Form",
        portraitMediaId: null,
        position: 0,
      },
    ]);
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

describe("upgradeLegacyCharacterBundle", () => {
  const currentBundle = makeBundle({
    characters: [
      makeCharacter({ appearances: [makeAppearance()], id: CHAR_A }),
      makeCharacter({
        appearances: [
          makeAppearance({ bookId: BOOK_OWNED }),
          makeAppearance({ bookId: BOOK_MISSING, firstAppearancePage: 412 }),
        ],
        id: CHAR_B,
        name: "Chani",
      }),
    ],
  });

  it("imports a bundle exported with both retired hiding flags set to true", () => {
    const legacyBundle = {
      ...currentBundle,
      characters: currentBundle.characters.map((character) => ({
        ...character,
        appearances: character.appearances.map((appearance) => ({
          ...appearance,
          hidePresenceAsSpoiler: true,
        })),
        hideProfileAsSpoiler: true,
      })),
    };

    expect(CharacterBundleSchema.safeParse(legacyBundle).success).toBe(false);
    const upgraded = CharacterBundleSchema.safeParse(upgradeLegacyCharacterBundle(legacyBundle));
    expect(upgraded.success).toBe(true);
    expect(upgraded.data).toEqual(currentBundle);
  });

  it("imports a bundle that never carried the retired hiding flags", () => {
    const upgraded = CharacterBundleSchema.safeParse(upgradeLegacyCharacterBundle(currentBundle));

    expect(upgraded.success).toBe(true);
    expect(upgraded.data).toEqual(currentBundle);
  });
});

const SPEC_FACT_LIMITS = { perAppearance: 200, total: 2000 } as const;

const LEGACY_DESCRIPTION = 'Перший рядок\n\n**Другий** рядок — <i>з тегами</i> & "лапками"';

function bookIdAt(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function bundleWithFactCounts(...factCountsPerCharacter: number[][]): CharacterBundle {
  return makeBundle({
    characters: factCountsPerCharacter.map((factCounts, characterIndex) =>
      makeCharacter({
        appearances: factCounts.map((count, appearanceIndex) =>
          makeAppearance({ bookId: bookIdAt(appearanceIndex + 1), facts: makeFacts(count) }),
        ),
        id: characterIdAt(characterIndex + 1),
        name: `Character ${characterIndex + 1}`,
      }),
    ),
  });
}

function characterIdAt(index: number): string {
  return `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`;
}

function importParseOutcome(payload: unknown): "invalid" | "parsed" | "tooLarge" {
  const result = CharacterBundleImportSchema.safeParse(payload);
  return result.success ? "parsed" : classifyBundleParseError(result.error);
}

function legacyV1Bundle(): Record<string, unknown> {
  const {
    facts: _facts,
    isUnreliableNarrator: _isUnreliableNarrator,
    isUnreliableNarratorSpoiler: _isUnreliableNarratorSpoiler,
    ...appearance
  } = makeAppearance({ description: LEGACY_DESCRIPTION });
  return {
    ...toV1Bundle(makeBundle()),
    characters: [
      {
        ...makeCharacter(),
        appearances: [{ ...appearance, hidePresenceAsSpoiler: true, narratorType: "unreliable" }],
        hideProfileAsSpoiler: true,
      },
    ],
  };
}

function withoutFormatVersion({
  formatVersion: _formatVersion,
  ...bundle
}: CharacterBundle): Record<string, unknown> {
  return bundle;
}

describe("CharacterBundleImportSchema — format versions", () => {
  it("upgrades a version 1 bundle to empty fact lists and reports the uploaded version", () => {
    const imported = CharacterBundleImportSchema.parse(toV1Bundle(bundleWithFactCounts([0, 0])));

    expect(imported.sourceFormatVersion).toBe(1);
    expect(imported.bundle.formatVersion).toBe(2);
    expect(
      imported.bundle.characters[0]?.appearances.map((appearance) => appearance.facts),
    ).toEqual([[], []]);
  });

  it("reports version 2 for a version 2 bundle and keeps its facts", () => {
    const imported = CharacterBundleImportSchema.parse(bundleWithFactCounts([2]));

    expect(imported.sourceFormatVersion).toBe(2);
    expect(imported.bundle.characters[0]?.appearances[0]?.facts).toEqual([
      makeFact({ title: "Fact 0" }),
      makeFact({ title: "Fact 1" }),
    ]);
  });

  it("imports a legacy version 1 bundle with retired spoiler flags and the unreliable narrator type", () => {
    const imported = CharacterBundleImportSchema.parse(legacyV1Bundle());

    expect(imported.sourceFormatVersion).toBe(1);
    expect(imported.bundle.characters[0]).not.toHaveProperty("hideProfileAsSpoiler");
    expect(imported.bundle.characters[0]?.appearances[0]).not.toHaveProperty(
      "hidePresenceAsSpoiler",
    );
    expect(imported.bundle.characters[0]?.appearances[0]).toMatchObject({
      facts: [],
      isUnreliableNarrator: true,
      isUnreliableNarratorSpoiler: false,
      narratorType: null,
    });
  });

  it("plans no facts for a legacy version 1 bundle", () => {
    const { bundle } = CharacterBundleImportSchema.parse(legacyV1Bundle());

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: new Date("2026-05-05T00:00:00.000Z"),
      owned,
      userId: USER_ID,
    });

    expect(draft.created.facts).toBe(0);
    expect(draft.facts).toEqual([]);
    expect(draft.created.appearances).toBe(1);
  });

  it("keeps a legacy version 1 appearance description verbatim", () => {
    const { bundle } = CharacterBundleImportSchema.parse(legacyV1Bundle());

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: new Date("2026-05-05T00:00:00.000Z"),
      owned,
      userId: USER_ID,
    });

    expect(draft.bookCharacters[0]?.description).toBe(LEGACY_DESCRIPTION);
  });

  it.each([
    { label: "version 0", payload: { ...bundleWithFactCounts([1]), formatVersion: 0 } },
    { label: "version 3", payload: { ...bundleWithFactCounts([1]), formatVersion: 3 } },
    { label: "a missing version", payload: withoutFormatVersion(bundleWithFactCounts([1])) },
  ])("rejects $label as invalid", ({ payload }) => {
    expect(importParseOutcome(payload)).toBe("invalid");
  });

  it("rejects a version 2 fact carrying an extra key as invalid", () => {
    const bundle = bundleWithFactCounts([1]);
    const hostile = {
      ...bundle,
      characters: bundle.characters.map((character) => ({
        ...character,
        appearances: character.appearances.map((appearance) => ({
          ...appearance,
          facts: appearance.facts.map((fact) => ({ ...fact, id: CHAR_B })),
        })),
      })),
    };

    expect(importParseOutcome(bundle)).toBe("parsed");
    expect(importParseOutcome(hostile)).toBe("invalid");
  });

  it("rejects a version 1 bundle whose appearances carry a facts key as invalid", () => {
    const bundle = bundleWithFactCounts([0]);

    expect(importParseOutcome(toV1Bundle(bundle))).toBe("parsed");
    expect(importParseOutcome({ ...bundle, formatVersion: 1 })).toBe("invalid");
  });

  it("rejects a version 2 bundle whose appearances omit facts as invalid", () => {
    const withoutFacts = toV1Bundle(bundleWithFactCounts([0]));

    expect(importParseOutcome({ ...withoutFacts, formatVersion: 2 })).toBe("invalid");
  });
});

describe("CharacterBundleImportSchema — fact limits", () => {
  it("accepts an appearance holding exactly the per-appearance fact limit", () => {
    expect(importParseOutcome(bundleWithFactCounts([SPEC_FACT_LIMITS.perAppearance]))).toBe(
      "parsed",
    );
  });

  it("classifies one fact over the per-appearance limit as too large", () => {
    expect(importParseOutcome(bundleWithFactCounts([SPEC_FACT_LIMITS.perAppearance + 1]))).toBe(
      "tooLarge",
    );
  });

  it("accepts a bundle holding exactly the total fact limit across characters", () => {
    const fullAppearances = Array.from({ length: 9 }, () => SPEC_FACT_LIMITS.perAppearance);
    const bundle = bundleWithFactCounts(
      [...fullAppearances, SPEC_FACT_LIMITS.perAppearance - 1],
      [1],
    );

    expect(importParseOutcome(bundle)).toBe("parsed");
  });

  it("classifies one fact over the total limit across characters as too large", () => {
    const fullAppearances = Array.from({ length: 10 }, () => SPEC_FACT_LIMITS.perAppearance);
    const bundle = bundleWithFactCounts(fullAppearances, [1]);

    expect(importParseOutcome(bundle)).toBe("tooLarge");
  });
});

describe("planCharacterImport — facts", () => {
  const IMPORT_NOW = new Date("2026-09-09T09:09:09.000Z");

  it("recreates facts with fresh ids under the new appearance and keeps their original fields", () => {
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          appearances: [
            makeAppearance({
              facts: [
                makeFact(),
                makeFact({ chapter: null, page: null, text: "Rides a sandworm", title: "Rider" }),
              ],
            }),
          ],
        }),
      ],
    });

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: IMPORT_NOW,
      owned,
      userId: USER_ID,
    });

    expect(draft.bookCharacters.map((appearance) => appearance.id)).toEqual(["fresh-2"]);
    expect(draft.facts).toEqual([
      {
        bookCharacterId: "fresh-2",
        chapter: "Book One",
        createdAt: new Date("2025-03-04T05:06:07.890Z"),
        id: "fresh-3",
        page: 42,
        text: "Survived the gom jabbar",
        title: "The test",
        updatedAt: new Date("2025-04-05T06:07:08.901Z"),
      },
      {
        bookCharacterId: "fresh-2",
        chapter: null,
        createdAt: new Date("2025-03-04T05:06:07.890Z"),
        id: "fresh-4",
        page: null,
        text: "Rides a sandworm",
        title: "Rider",
        updatedAt: new Date("2025-04-05T06:07:08.901Z"),
      },
    ]);
    expect(draft.created.facts).toBe(2);
  });

  it("skips the facts of an appearance whose book the importer does not own", () => {
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          appearances: [
            makeAppearance({ bookId: BOOK_MISSING, facts: makeFacts(3) }),
            makeAppearance({ bookId: BOOK_OWNED, facts: [makeFact({ title: "Kept" })] }),
          ],
        }),
      ],
    });

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: IMPORT_NOW,
      owned,
      userId: USER_ID,
    });

    expect(draft.skipped.appearancesMissingBook).toBe(1);
    expect(draft.skipped.factsMissingBook).toBe(3);
    expect(draft.created.facts).toBe(1);
    expect(draft.facts.map((fact) => fact.title)).toEqual(["Kept"]);
    expect(draft.facts.map((fact) => fact.bookCharacterId)).toEqual(
      draft.bookCharacters.map((appearance) => appearance.id),
    );
  });

  it("attaches the facts of a duplicate appearance of the same book to the kept appearance", () => {
    const bundle = makeBundle({
      characters: [
        makeCharacter({
          appearances: [
            makeAppearance({
              facts: [makeFact({ title: "First" }), makeFact({ title: "Second" })],
            }),
            makeAppearance({ facts: [makeFact({ title: "From duplicate" })] }),
          ],
        }),
      ],
    });

    const draft = planCharacterImport({
      bundle,
      newId: idFactory(),
      now: IMPORT_NOW,
      owned,
      userId: USER_ID,
    });

    expect(draft.created.appearances).toBe(1);
    expect(draft.created.facts).toBe(3);
    expect(draft.skipped.factsMissingBook).toBe(0);
    expect(draft.facts.map((fact) => [fact.title, fact.bookCharacterId])).toEqual([
      ["First", "fresh-2"],
      ["Second", "fresh-2"],
      ["From duplicate", "fresh-2"],
    ]);
  });
});

describe("serializeCharacterBundle — facts", () => {
  it("serializes facts in the order received with ISO timestamps", () => {
    const source: CharacterExportSource = {
      characters: [
        {
          aliases: [],
          archivedAt: null,
          avatarMediaId: null,
          bookAppearances: [
            {
              ...makeAppearance(),
              facts: [
                {
                  chapter: "II",
                  createdAt: new Date("2025-06-01T00:00:00.000Z"),
                  page: 7,
                  text: "Newer",
                  title: "B",
                  updatedAt: new Date("2025-06-02T00:00:00.000Z"),
                },
                {
                  chapter: null,
                  createdAt: new Date("2025-01-01T00:00:00.000Z"),
                  page: null,
                  text: "Older",
                  title: "A",
                  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
                },
              ],
              roles: [],
              speciesOverride: null,
            },
          ],
          customGender: null,
          entityKind: "individual",
          forms: [],
          gender: "unknown",
          globalAttitude: null,
          id: CHAR_A,
          isFavorite: false,
          name: "Paul",
          neutralDescription: null,
          pronouns: null,
          species: null,
          tags: [],
        },
      ],
      groups: [],
      relationships: [],
      theories: [],
    };

    const bundle = serializeCharacterBundle({ exportedAt: new Date(), source });

    expect(bundle.characters[0]?.appearances[0]?.facts).toEqual([
      {
        chapter: "II",
        createdAt: "2025-06-01T00:00:00.000Z",
        page: 7,
        text: "Newer",
        title: "B",
        updatedAt: "2025-06-02T00:00:00.000Z",
      },
      {
        chapter: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        page: null,
        text: "Older",
        title: "A",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
    expect(CharacterBundleSchema.safeParse(bundle).success).toBe(true);
  });
});

type RawAttitudeBundleFixture = {
  appearanceAttitude: Nullable<string>;
  formatVersion: 1 | 2;
  globalAttitude: Nullable<string>;
  isFavorite: boolean;
};

function rawAttitudeBundle({
  appearanceAttitude,
  formatVersion,
  globalAttitude,
  isFavorite,
}: RawAttitudeBundleFixture): Record<string, unknown> {
  const { facts, ...appearanceWithoutFacts } = makeAppearance();
  const appearance =
    formatVersion === 1 ? appearanceWithoutFacts : { ...appearanceWithoutFacts, facts };
  return {
    ...makeBundle(),
    characters: [
      {
        ...makeCharacter({ isFavorite }),
        appearances: [{ ...appearance, attitude: appearanceAttitude }],
        globalAttitude,
      },
    ],
    formatVersion,
  };
}

describe("CharacterBundleImportSchema — legacy favorite attitude", () => {
  it.each([1, 2] as const)(
    "turns a global favorite into like and hearts the character in a version %i bundle",
    (formatVersion) => {
      const { bundle } = CharacterBundleImportSchema.parse(
        rawAttitudeBundle({
          appearanceAttitude: null,
          formatVersion,
          globalAttitude: "favorite",
          isFavorite: false,
        }),
      );

      expect(bundle.characters[0]).toMatchObject({ globalAttitude: "like", isFavorite: true });
    },
  );

  it.each([1, 2] as const)(
    "turns a per-book favorite into like without hearting the character in a version %i bundle",
    (formatVersion) => {
      const { bundle } = CharacterBundleImportSchema.parse(
        rawAttitudeBundle({
          appearanceAttitude: "favorite",
          formatVersion,
          globalAttitude: "neutral",
          isFavorite: false,
        }),
      );

      expect(bundle.characters[0]).toMatchObject({ globalAttitude: "neutral", isFavorite: false });
      expect(bundle.characters[0]?.appearances[0]?.attitude).toBe("like");
    },
  );

  it.each([1, 2] as const)(
    "yields a bundle the strict export schema accepts from a version %i bundle with favorites",
    (formatVersion) => {
      const { bundle } = CharacterBundleImportSchema.parse(
        rawAttitudeBundle({
          appearanceAttitude: "favorite",
          formatVersion,
          globalAttitude: "favorite",
          isFavorite: false,
        }),
      );

      expect(CharacterBundleSchema.safeParse(bundle).success).toBe(true);
    },
  );
});

describe("CharacterBundleSchema — retired favorite attitude", () => {
  it.each([
    {
      appearanceAttitude: null,
      globalAttitude: "favorite",
      label: "global attitude",
      path: ["characters", 0, "globalAttitude"],
    },
    {
      appearanceAttitude: "favorite",
      globalAttitude: null,
      label: "appearance attitude",
      path: ["characters", 0, "appearances", 0, "attitude"],
    },
  ])(
    "rejects favorite as the $label of an export",
    ({ appearanceAttitude, globalAttitude, path }) => {
      const result = CharacterBundleSchema.safeParse(
        rawAttitudeBundle({
          appearanceAttitude,
          formatVersion: 2,
          globalAttitude,
          isFavorite: true,
        }),
      );

      expect(result.error?.issues.map((issue) => issue.path)).toEqual([path]);
    },
  );

  it("accepts like in both attitude slots of an export", () => {
    const result = CharacterBundleSchema.safeParse(
      rawAttitudeBundle({
        appearanceAttitude: "like",
        formatVersion: 2,
        globalAttitude: "like",
        isFavorite: true,
      }),
    );

    expect(result.success).toBe(true);
  });
});

import {
  boundedArray,
  CHARACTER_BUNDLE_ALIASES_PER_CHARACTER_MAX,
  CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX,
  CHARACTER_BUNDLE_BOOK_STATES_PER_RELATIONSHIP_MAX,
  CHARACTER_BUNDLE_CHARACTERS_MAX,
  CHARACTER_BUNDLE_FACTS_PER_APPEARANCE_MAX,
  CHARACTER_BUNDLE_FORMS_PER_CHARACTER_MAX,
  CHARACTER_BUNDLE_GROUPS_MAX,
  CHARACTER_BUNDLE_MEMBERS_PER_GROUP_MAX,
  CHARACTER_BUNDLE_RELATIONSHIPS_MAX,
  CHARACTER_BUNDLE_ROLES_PER_APPEARANCE_MAX,
  CHARACTER_BUNDLE_TAGS_PER_CHARACTER_MAX,
  CHARACTER_BUNDLE_THEORIES_MAX,
  CharacterBundleImportSchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const CHARACTER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "33333333-3333-4333-8333-333333333333";

type ArrayCase = {
  key: string;
  level: BundleLevel;
  maxLength: number;
  path: (number | string)[];
  versions: (1 | 2)[];
};

type ArrayOverride = {
  items: unknown[];
  key: string;
  level: BundleLevel;
};

type BundleLevel = "appearance" | "bundle" | "character" | "group" | "relationship";

const BOTH_VERSIONS: (1 | 2)[] = [1, 2];

const ARRAY_CASES: ArrayCase[] = [
  {
    key: "characters",
    level: "bundle",
    maxLength: CHARACTER_BUNDLE_CHARACTERS_MAX,
    path: ["characters"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "groups",
    level: "bundle",
    maxLength: CHARACTER_BUNDLE_GROUPS_MAX,
    path: ["groups"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "relationships",
    level: "bundle",
    maxLength: CHARACTER_BUNDLE_RELATIONSHIPS_MAX,
    path: ["relationships"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "theories",
    level: "bundle",
    maxLength: CHARACTER_BUNDLE_THEORIES_MAX,
    path: ["theories"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "aliases",
    level: "character",
    maxLength: CHARACTER_BUNDLE_ALIASES_PER_CHARACTER_MAX,
    path: ["characters", 0, "aliases"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "appearances",
    level: "character",
    maxLength: CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX,
    path: ["characters", 0, "appearances"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "forms",
    level: "character",
    maxLength: CHARACTER_BUNDLE_FORMS_PER_CHARACTER_MAX,
    path: ["characters", 0, "forms"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "tagIds",
    level: "character",
    maxLength: CHARACTER_BUNDLE_TAGS_PER_CHARACTER_MAX,
    path: ["characters", 0, "tagIds"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "roles",
    level: "appearance",
    maxLength: CHARACTER_BUNDLE_ROLES_PER_APPEARANCE_MAX,
    path: ["characters", 0, "appearances", 0, "roles"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "facts",
    level: "appearance",
    maxLength: CHARACTER_BUNDLE_FACTS_PER_APPEARANCE_MAX,
    path: ["characters", 0, "appearances", 0, "facts"],
    versions: [2],
  },
  {
    key: "memberships",
    level: "group",
    maxLength: CHARACTER_BUNDLE_MEMBERS_PER_GROUP_MAX,
    path: ["groups", 0, "memberships"],
    versions: BOTH_VERSIONS,
  },
  {
    key: "bookStates",
    level: "relationship",
    maxLength: CHARACTER_BUNDLE_BOOK_STATES_PER_RELATIONSHIP_MAX,
    path: ["relationships", 0, "bookStates"],
    versions: BOTH_VERSIONS,
  },
];

function appearanceRecord({
  formatVersion,
  override,
}: {
  formatVersion: 1 | 2;
  override?: ArrayOverride;
}): Record<string, unknown> {
  return {
    appearanceNotes: null,
    appearanceNotesIsSpoiler: false,
    attitude: null,
    bookId: BOOK_ID,
    description: null,
    descriptionIsSpoiler: false,
    displayName: null,
    displayNameIsSpoiler: false,
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
    ...(formatVersion === 2 && { facts: [] }),
    ...overrideAt({ level: "appearance", override }),
  };
}

function bundleRecord({
  formatVersion,
  override,
}: {
  formatVersion: 1 | 2;
  override?: ArrayOverride;
}): Record<string, unknown> {
  return {
    characters: [characterRecord({ formatVersion, override })],
    exportedAt: "2026-01-01T00:00:00.000Z",
    formatVersion,
    groups: [groupRecord(override)],
    relationships: [relationshipRecord(override)],
    theories: [],
    ...overrideAt({ level: "bundle", override }),
  };
}

function characterRecord({
  formatVersion,
  override,
}: {
  formatVersion: 1 | 2;
  override?: ArrayOverride;
}): Record<string, unknown> {
  return {
    aliases: [],
    appearances: [appearanceRecord({ formatVersion, override })],
    avatarMediaId: null,
    customGender: null,
    entityKind: "individual",
    forms: [],
    gender: "unknown",
    globalAttitude: null,
    id: CHARACTER_ID,
    isArchived: false,
    isFavorite: false,
    name: "Paul",
    neutralDescription: null,
    pronouns: null,
    species: null,
    tagIds: [],
    ...overrideAt({ level: "character", override }),
  };
}

function countingNumberElement(): { calls: { count: number }; element: z.ZodType<number> } {
  const calls = { count: 0 };
  const element = z.custom<number>((value) => {
    calls.count += 1;
    return typeof value === "number";
  });
  return { calls, element };
}

function groupRecord(override?: ArrayOverride): Record<string, unknown> {
  return {
    customType: null,
    description: null,
    isSpoiler: false,
    memberships: [],
    name: "House Atreides",
    seriesId: null,
    type: "house",
    ...overrideAt({ level: "group", override }),
  };
}

function overrideAt({
  level,
  override,
}: {
  level: BundleLevel;
  override?: ArrayOverride;
}): Record<string, unknown> {
  return override?.level === level ? { [override.key]: override.items } : {};
}

function relationshipRecord(override?: ArrayOverride): Record<string, unknown> {
  return {
    bookStates: [],
    category: "social",
    customType: null,
    directionality: "symmetric",
    isCanonical: false,
    sourceCharacterId: CHARACTER_ID,
    sourceLabel: null,
    targetCharacterId: CHARACTER_ID,
    targetLabel: null,
    type: "friend_of",
    ...overrideAt({ level: "relationship", override }),
  };
}

describe("boundedArray", () => {
  it("rejects an over-long array without invoking the element schema", () => {
    const { calls, element } = countingNumberElement();

    const result = boundedArray(element, 2).safeParse([1, 2, 3]);

    expect(calls.count).toBe(0);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: "too_big", maximum: 2, origin: "array", path: [] }),
    ]);
  });

  it("stops at the first invalid element", () => {
    const { calls, element } = countingNumberElement();

    const result = boundedArray(element, 10).safeParse([1, "bad", "bad", 4]);

    expect(calls.count).toBe(2);
    expect(result.error?.issues).toEqual([expect.objectContaining({ path: [1] })]);
  });

  it("parses every element of a valid array", () => {
    expect(boundedArray(z.number(), 3).parse([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("keeps the early exit after describe and meta clone the schema", () => {
    const { calls, element } = countingNumberElement();
    const described = boundedArray(element, 2).describe("bounded").meta({ title: "Bounded" });

    described.safeParse([1, 2, 3]);
    described.safeParse(["bad", "bad"]);

    expect(calls.count).toBe(1);
  });

  it("stops at the first invalid element of an async element schema", async () => {
    const calls = { count: 0 };
    const element = z.number().refine(async (value) => {
      calls.count += 1;
      return value > 0;
    });

    const result = await boundedArray(element, 5).safeParseAsync([1, -1, 2]);

    expect(calls.count).toBe(2);
    expect(result.error?.issues).toEqual([expect.objectContaining({ path: [1] })]);
  });

  it("aborts the parent refinement when the array is over-long", () => {
    const calls = { count: 0 };
    const parent = z.object({ items: boundedArray(z.number(), 1) }).superRefine(() => {
      calls.count += 1;
    });

    parent.safeParse({ items: [1, 2] });

    expect(calls.count).toBe(0);
  });

  it("publishes the same JSON Schema as a plain max-length array", () => {
    const element = z.object({ name: z.string().max(3) }).strict();

    for (const io of ["input", "output"] as const) {
      expect(z.toJSONSchema(boundedArray(element, 7), { io })).toEqual(
        z.toJSONSchema(z.array(element).max(7), { io }),
      );
    }
  });
});

describe("CharacterBundleImportSchema array bounds", () => {
  it.each(BOTH_VERSIONS)("accepts the version %i baseline bundle", (formatVersion) => {
    expect(CharacterBundleImportSchema.safeParse(bundleRecord({ formatVersion })).success).toBe(
      true,
    );
  });

  const versionedCases = ARRAY_CASES.flatMap((arrayCase) =>
    arrayCase.versions.map((formatVersion) => ({ ...arrayCase, formatVersion })),
  );

  it.each(versionedCases)(
    "reports a single too_big for an over-long $level $key array in version $formatVersion",
    ({ formatVersion, key, level, maxLength, path }) => {
      const items = Array.from({ length: maxLength + 1 }, () => null);

      const result = CharacterBundleImportSchema.safeParse(
        bundleRecord({ formatVersion, override: { items, key, level } }),
      );

      expect(result.error?.issues).toEqual([
        expect.objectContaining({ code: "too_big", maximum: maxLength, origin: "array", path }),
      ]);
    },
  );

  it("never runs bundle refinements over raw collection elements", () => {
    const relationshipWithLongLabel = { ...relationshipRecord(), sourceLabel: "x".repeat(121) };

    const result = CharacterBundleImportSchema.safeParse({
      ...bundleRecord({ formatVersion: 2 }),
      relationships: [relationshipWithLongLabel, null, 0],
    });

    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: "too_big", path: ["relationships", 0, "sourceLabel"] }),
    ]);
  });
});

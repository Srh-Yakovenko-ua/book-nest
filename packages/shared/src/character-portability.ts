import { z } from "zod";

import { boundedArray } from "./bounded-array.js";
import { CHARACTER_FACT_FIELDS } from "./character-facts.js";
import { CharacterGroupTypeSchema } from "./character-groups.js";
import {
  getRelationshipTypeCategory,
  getRelationshipTypeDirectionality,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "./character-relationships.js";
import { CharacterTheoryStatusSchema } from "./character-theories.js";
import {
  BookCharacterImportanceSchema,
  BookCharacterNarratorTypeSchema,
  BookCharacterRoleTypeSchema,
  BookCharacterStatusSchema,
  CHARACTER_INT4_MAX,
  CharacterAliasTypeSchema,
  type CharacterAttitude,
  CharacterAttitudeSchema,
  CharacterEntityKindSchema,
  CharacterFormTypeSchema,
  CharacterGenderSchema,
} from "./characters.js";
import { type Nullable } from "./common.js";
import { SPECIES_SEARCH } from "./species.js";

export const CHARACTER_BUNDLE_FORMAT_VERSION = 2;
const CHARACTER_BUNDLE_V1_FORMAT_VERSION = 1;

const BUNDLE_NAME_MAX = 200;
const BUNDLE_SHORT_TEXT_MAX = 200;
const BUNDLE_SPECIES_KEY_MAX = 60;
const BUNDLE_GENDER_CUSTOM_MAX = 60;
const BUNDLE_PRONOUNS_MAX = 60;
const BUNDLE_LONG_TEXT_MAX = 5000;
const BUNDLE_CUSTOM_TYPE_MAX = 60;
const BUNDLE_LABEL_MAX = 120;
const BUNDLE_CHAPTER_MAX = 200;

export const CHARACTER_BUNDLE_CHARACTERS_MAX = 1000;
export const CHARACTER_BUNDLE_GROUPS_MAX = 300;
export const CHARACTER_BUNDLE_RELATIONSHIPS_MAX = 3000;
export const CHARACTER_BUNDLE_THEORIES_MAX = 2000;
export const CHARACTER_BUNDLE_ALIASES_PER_CHARACTER_MAX = 30;
export const CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX = 200;
export const CHARACTER_BUNDLE_FORMS_PER_CHARACTER_MAX = 50;
export const CHARACTER_BUNDLE_ROLES_PER_APPEARANCE_MAX = 20;
export const CHARACTER_BUNDLE_TAGS_PER_CHARACTER_MAX = 15;
export const CHARACTER_BUNDLE_MEMBERS_PER_GROUP_MAX = 100;
export const CHARACTER_BUNDLE_BOOK_STATES_PER_RELATIONSHIP_MAX = 200;
export const CHARACTER_BUNDLE_FACTS_PER_APPEARANCE_MAX = 200;
export const CHARACTER_BUNDLE_FACTS_TOTAL_MAX = 2000;

export const CHARACTER_IMPORT_ERROR_CODES = {
  invalid: "character_import_invalid",
  tooLarge: "character_import_too_large",
} as const;

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const positionInt = z.number().int().min(0).max(CHARACTER_INT4_MAX);
const nullablePositiveInt = z.number().int().positive().max(CHARACTER_INT4_MAX).nullable();
const nullableNonNegativeInt = z.number().int().min(0).max(CHARACTER_INT4_MAX).nullable();
const externalRef = () => z.uuid();
const speciesKeyRef = () => z.string().trim().min(1).max(BUNDLE_SPECIES_KEY_MAX).nullish();

const ONLY_WHEN_PARSED_CLEANLY = {
  when: (payload: z.core.ParsePayload) => payload.issues.length === 0,
} satisfies z.core.$ZodSuperRefineParams;

const LEGACY_FAVORITE_ATTITUDE = {
  replacement: "like",
  value: "favorite",
} as const satisfies { replacement: CharacterAttitude; value: string };

const ImportableCharacterAttitudeSchema = z.enum([
  ...CharacterAttitudeSchema.options,
  LEGACY_FAVORITE_ATTITUDE.value,
]);

type ImportableCharacterAttitude = z.infer<typeof ImportableCharacterAttitudeSchema>;

const BundleAliasSchema = z
  .object({
    bookId: externalRef().nullable(),
    isSpoiler: z.boolean(),
    name: z.string().trim().min(1).max(BUNDLE_NAME_MAX),
    position: positionInt,
    type: CharacterAliasTypeSchema,
  })
  .strict();

export type BundleAlias = z.infer<typeof BundleAliasSchema>;

const BundleRoleSchema = z
  .object({
    customRole: nullableText(BUNDLE_SHORT_TEXT_MAX),
    isSpoiler: z.boolean(),
    position: positionInt,
    roleType: BookCharacterRoleTypeSchema,
  })
  .strict();

export type BundleRole = z.infer<typeof BundleRoleSchema>;

const BundleFactSchema = z
  .object({
    chapter: CHARACTER_FACT_FIELDS.chapterText.nullable(),
    createdAt: z.iso.datetime(),
    page: z
      .number()
      .check(...CHARACTER_FACT_FIELDS.pageChecks)
      .nullable(),
    text: CHARACTER_FACT_FIELDS.text,
    title: CHARACTER_FACT_FIELDS.title,
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type BundleFact = z.infer<typeof BundleFactSchema>;

const BundleAppearanceV1Schema = z
  .object({
    appearanceNotes: nullableText(BUNDLE_LONG_TEXT_MAX),
    appearanceNotesIsSpoiler: z.boolean(),
    attitude: CharacterAttitudeSchema.nullable(),
    bookId: externalRef(),
    description: nullableText(BUNDLE_LONG_TEXT_MAX),
    descriptionIsSpoiler: z.boolean(),
    displayName: nullableText(BUNDLE_SHORT_TEXT_MAX),
    displayNameIsSpoiler: z.boolean(),
    firstAppearanceAudioSeconds: nullableNonNegativeInt,
    firstAppearanceChapter: nullableText(BUNDLE_SHORT_TEXT_MAX),
    firstAppearanceNote: nullableText(BUNDLE_SHORT_TEXT_MAX),
    firstAppearancePage: nullablePositiveInt,
    importance: BookCharacterImportanceSchema,
    isPovCharacter: z.boolean(),
    isUnreliableNarrator: z.boolean().default(false),
    isUnreliableNarratorSpoiler: z.boolean().default(false),
    narratorType: BookCharacterNarratorTypeSchema.nullable(),
    personalImpression: nullableText(BUNDLE_LONG_TEXT_MAX),
    personalImpressionIsSpoiler: z.boolean(),
    portraitIsSpoiler: z.boolean(),
    portraitMediaId: externalRef().nullable(),
    roles: boundedArray(BundleRoleSchema, CHARACTER_BUNDLE_ROLES_PER_APPEARANCE_MAX),
    sortOrder: nullableNonNegativeInt,
    speciesOverride: nullableText(SPECIES_SEARCH.nameMax),
    speciesOverrideIsSpoiler: z.boolean(),
    speciesOverrideKey: speciesKeyRef(),
    status: BookCharacterStatusSchema,
    statusCustomText: nullableText(BUNDLE_SHORT_TEXT_MAX),
    statusIsSpoiler: z.boolean(),
  })
  .strict();

const BundleAppearanceSchema = BundleAppearanceV1Schema.extend({
  facts: boundedArray(BundleFactSchema, CHARACTER_BUNDLE_FACTS_PER_APPEARANCE_MAX),
});

export type BundleAppearance = z.infer<typeof BundleAppearanceSchema>;

const importableAppearanceAttitude = { attitude: ImportableCharacterAttitudeSchema.nullable() };

const ImportableBundleAppearanceV1Schema = BundleAppearanceV1Schema.extend(
  importableAppearanceAttitude,
);

const ImportableBundleAppearanceSchema = BundleAppearanceSchema.extend(
  importableAppearanceAttitude,
);

const BundleFormSchema = z
  .object({
    description: nullableText(BUNDLE_LONG_TEXT_MAX),
    formType: CharacterFormTypeSchema,
    isSpoiler: z.boolean(),
    name: z.string().trim().min(1).max(BUNDLE_NAME_MAX),
    portraitMediaId: externalRef().nullable(),
    position: positionInt,
  })
  .strict();

export type BundleForm = z.infer<typeof BundleFormSchema>;

const bundleCharacterFields = {
  aliases: boundedArray(BundleAliasSchema, CHARACTER_BUNDLE_ALIASES_PER_CHARACTER_MAX),
  avatarMediaId: externalRef().nullable(),
  customGender: nullableText(BUNDLE_GENDER_CUSTOM_MAX),
  entityKind: CharacterEntityKindSchema,
  forms: boundedArray(BundleFormSchema, CHARACTER_BUNDLE_FORMS_PER_CHARACTER_MAX),
  gender: CharacterGenderSchema,
  globalAttitude: CharacterAttitudeSchema.nullable(),
  id: z.uuid(),
  isArchived: z.boolean(),
  isFavorite: z.boolean(),
  name: z.string().trim().min(1).max(BUNDLE_NAME_MAX),
  neutralDescription: nullableText(BUNDLE_LONG_TEXT_MAX),
  pronouns: nullableText(BUNDLE_PRONOUNS_MAX),
  species: nullableText(SPECIES_SEARCH.nameMax),
  speciesKey: speciesKeyRef(),
  tagIds: boundedArray(externalRef(), CHARACTER_BUNDLE_TAGS_PER_CHARACTER_MAX),
};

const importableBundleCharacterFields = {
  ...bundleCharacterFields,
  globalAttitude: ImportableCharacterAttitudeSchema.nullable(),
};

const BundleCharacterV1Schema = z
  .object({
    ...importableBundleCharacterFields,
    appearances: boundedArray(
      ImportableBundleAppearanceV1Schema,
      CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX,
    ),
  })
  .strict()
  .superRefine(requireCustomGender, ONLY_WHEN_PARSED_CLEANLY);

type BundleCharacterV1 = z.infer<typeof BundleCharacterV1Schema>;

const BundleCharacterSchema = z
  .object({
    ...bundleCharacterFields,
    appearances: boundedArray(
      BundleAppearanceSchema,
      CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX,
    ),
  })
  .strict()
  .superRefine(requireCustomGender, ONLY_WHEN_PARSED_CLEANLY);

export type BundleCharacter = z.infer<typeof BundleCharacterSchema>;

const ImportableBundleCharacterSchema = z
  .object({
    ...importableBundleCharacterFields,
    appearances: boundedArray(
      ImportableBundleAppearanceSchema,
      CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX,
    ),
  })
  .strict()
  .superRefine(requireCustomGender, ONLY_WHEN_PARSED_CLEANLY);

type ImportableBundleCharacter = z.infer<typeof ImportableBundleCharacterSchema>;

const BundleMembershipSchema = z
  .object({
    bookId: externalRef().nullable(),
    characterId: z.uuid(),
    isSpoiler: z.boolean(),
    role: nullableText(BUNDLE_SHORT_TEXT_MAX),
    status: nullableText(BUNDLE_SHORT_TEXT_MAX),
  })
  .strict();

export type BundleMembership = z.infer<typeof BundleMembershipSchema>;

const BundleGroupSchema = z
  .object({
    customType: nullableText(BUNDLE_CUSTOM_TYPE_MAX),
    description: nullableText(BUNDLE_LONG_TEXT_MAX),
    isSpoiler: z.boolean(),
    memberships: boundedArray(BundleMembershipSchema, CHARACTER_BUNDLE_MEMBERS_PER_GROUP_MAX),
    name: z.string().trim().min(1).max(BUNDLE_NAME_MAX),
    seriesId: externalRef().nullable(),
    type: CharacterGroupTypeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "custom" && (value.customType ?? "").trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customType is required when type is custom",
        path: ["customType"],
      });
    }
  }, ONLY_WHEN_PARSED_CLEANLY);

export type BundleGroup = z.infer<typeof BundleGroupSchema>;

const BundleBookStateSchema = z
  .object({
    bookId: externalRef(),
    description: nullableText(BUNDLE_LONG_TEXT_MAX),
    endedAudioSeconds: nullablePositiveInt,
    endedChapter: nullableText(BUNDLE_CHAPTER_MAX),
    endedPage: nullablePositiveInt,
    hideRelationshipAsSpoiler: z.boolean(),
    intensity: RelationshipIntensitySchema.nullable(),
    introducedAudioSeconds: nullablePositiveInt,
    introducedChapter: nullableText(BUNDLE_CHAPTER_MAX),
    introducedPage: nullablePositiveInt,
    isDescriptionSpoiler: z.boolean(),
    isTypeSpoiler: z.boolean(),
    status: RelationshipBookStateStatusSchema,
  })
  .strict();

export type BundleBookState = z.infer<typeof BundleBookStateSchema>;

const BundleRelationshipSchema = z
  .object({
    bookStates: boundedArray(
      BundleBookStateSchema,
      CHARACTER_BUNDLE_BOOK_STATES_PER_RELATIONSHIP_MAX,
    ),
    category: RelationshipCategorySchema,
    customType: nullableText(BUNDLE_CUSTOM_TYPE_MAX),
    directionality: RelationshipDirectionalitySchema,
    isCanonical: z.boolean(),
    sourceCharacterId: z.uuid(),
    sourceLabel: nullableText(BUNDLE_LABEL_MAX),
    targetCharacterId: z.uuid(),
    targetLabel: nullableText(BUNDLE_LABEL_MAX),
    type: RelationshipTypeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "custom") {
      if ((value.customType ?? "").trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customType is required when type is custom",
          path: ["customType"],
        });
      }
      if (value.category !== "custom") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "category must be custom when type is custom",
          path: ["category"],
        });
      }
      return;
    }
    if (value.category !== getRelationshipTypeCategory(value.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "type does not belong to the given category",
        path: ["category"],
      });
    }
    if (value.directionality !== getRelationshipTypeDirectionality(value.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "directionality does not match the relationship type",
        path: ["directionality"],
      });
    }
    if (value.customType !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customType is only allowed when type is custom",
        path: ["customType"],
      });
    }
  }, ONLY_WHEN_PARSED_CLEANLY);

export type BundleRelationship = z.infer<typeof BundleRelationshipSchema>;

const BundleTheorySchema = z
  .object({
    bookId: externalRef().nullable(),
    characterId: z.uuid().nullable(),
    isSpoiler: z.boolean(),
    seriesId: externalRef().nullable(),
    status: CharacterTheoryStatusSchema,
    text: z.string().trim().min(1).max(BUNDLE_LONG_TEXT_MAX),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.characterId === null && value.bookId === null && value.seriesId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A theory must target a character, a book or a series",
        path: ["characterId"],
      });
    }
  }, ONLY_WHEN_PARSED_CLEANLY);

export type BundleTheory = z.infer<typeof BundleTheorySchema>;

const bundleCollectionFields = {
  exportedAt: z.iso.datetime(),
  groups: boundedArray(BundleGroupSchema, CHARACTER_BUNDLE_GROUPS_MAX),
  relationships: boundedArray(BundleRelationshipSchema, CHARACTER_BUNDLE_RELATIONSHIPS_MAX),
  theories: boundedArray(BundleTheorySchema, CHARACTER_BUNDLE_THEORIES_MAX),
};

const CharacterBundleV1Schema = z
  .object({
    ...bundleCollectionFields,
    characters: boundedArray(BundleCharacterV1Schema, CHARACTER_BUNDLE_CHARACTERS_MAX),
    formatVersion: z.literal(CHARACTER_BUNDLE_V1_FORMAT_VERSION),
  })
  .strict()
  .superRefine(requireBundleCharacterReferences, ONLY_WHEN_PARSED_CLEANLY);

type CharacterBundleV1 = z.infer<typeof CharacterBundleV1Schema>;

export const CharacterBundleSchema = z
  .object({
    ...bundleCollectionFields,
    characters: boundedArray(BundleCharacterSchema, CHARACTER_BUNDLE_CHARACTERS_MAX),
    formatVersion: z.literal(CHARACTER_BUNDLE_FORMAT_VERSION),
  })
  .strict()
  .superRefine(requireCurrentBundleIntegrity, ONLY_WHEN_PARSED_CLEANLY);

export type CharacterBundle = z.infer<typeof CharacterBundleSchema>;

const ImportableCharacterBundleSchema = z
  .object({
    ...bundleCollectionFields,
    characters: boundedArray(ImportableBundleCharacterSchema, CHARACTER_BUNDLE_CHARACTERS_MAX),
    formatVersion: z.literal(CHARACTER_BUNDLE_FORMAT_VERSION),
  })
  .strict()
  .superRefine(requireCurrentBundleIntegrity, ONLY_WHEN_PARSED_CLEANLY);

type ImportableCharacterBundle = z.infer<typeof ImportableCharacterBundleSchema>;

export const CharacterBundleAnyVersionSchema = z.discriminatedUnion("formatVersion", [
  CharacterBundleV1Schema,
  ImportableCharacterBundleSchema,
]);

type BundleCharacterReferences = {
  characters: readonly { id: string }[];
  groups: readonly BundleGroup[];
  relationships: readonly BundleRelationship[];
  theories: readonly BundleTheory[];
};

type BundleFactCarrier = {
  characters: readonly { appearances: readonly { facts: readonly BundleFact[] }[] }[];
};

function countBundleFacts(bundle: BundleFactCarrier): number {
  return bundle.characters.reduce(
    (characterTotal, character) =>
      characterTotal +
      character.appearances.reduce(
        (appearanceTotal, appearance) => appearanceTotal + appearance.facts.length,
        0,
      ),
    0,
  );
}

function limitBundleFactTotal(bundle: BundleFactCarrier, ctx: z.RefinementCtx): void {
  if (countBundleFacts(bundle) <= CHARACTER_BUNDLE_FACTS_TOTAL_MAX) {
    return;
  }
  ctx.addIssue({
    code: "too_big",
    inclusive: true,
    maximum: CHARACTER_BUNDLE_FACTS_TOTAL_MAX,
    message: `A bundle may contain at most ${CHARACTER_BUNDLE_FACTS_TOTAL_MAX} facts`,
    origin: "array",
    path: ["characters"],
  });
}

function requireBundleCharacterReferences(
  bundle: BundleCharacterReferences,
  ctx: z.RefinementCtx,
): void {
  const characterIds = new Set<string>();
  for (const [index, character] of bundle.characters.entries()) {
    if (characterIds.has(character.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Character ids must be unique within the bundle",
        path: ["characters", index, "id"],
      });
      continue;
    }
    characterIds.add(character.id);
  }
  for (const [groupIndex, group] of bundle.groups.entries()) {
    for (const [memberIndex, membership] of group.memberships.entries()) {
      if (!characterIds.has(membership.characterId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Membership references a character that is not part of the bundle",
          path: ["groups", groupIndex, "memberships", memberIndex, "characterId"],
        });
      }
    }
  }
  for (const [index, relationship] of bundle.relationships.entries()) {
    if (!characterIds.has(relationship.sourceCharacterId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relationship references a source character that is not part of the bundle",
        path: ["relationships", index, "sourceCharacterId"],
      });
    }
    if (!characterIds.has(relationship.targetCharacterId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relationship references a target character that is not part of the bundle",
        path: ["relationships", index, "targetCharacterId"],
      });
    }
  }
  for (const [index, theory] of bundle.theories.entries()) {
    if (theory.characterId !== null && !characterIds.has(theory.characterId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Theory references a character that is not part of the bundle",
        path: ["theories", index, "characterId"],
      });
    }
  }
}

function requireCurrentBundleIntegrity(
  bundle: BundleCharacterReferences & BundleFactCarrier,
  ctx: z.RefinementCtx,
): void {
  requireBundleCharacterReferences(bundle, ctx);
  limitBundleFactTotal(bundle, ctx);
}

function requireCustomGender(
  character: { customGender: Nullable<string>; gender: string },
  ctx: z.RefinementCtx,
): void {
  if (character.gender === "custom" && (character.customGender ?? "").trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "customGender is required when gender is custom",
      path: ["customGender"],
    });
  }
}

const LEGACY_UNRELIABLE_NARRATOR_TYPE = "unreliable";

const LEGACY_RECORD_MAX_KEYS = {
  appearance: Object.keys(BundleAppearanceV1Schema.shape).length + 1,
  bundle: Object.keys(CharacterBundleV1Schema.shape).length,
  character: Object.keys(BundleCharacterV1Schema.shape).length + 1,
} as const;

export function upgradeLegacyCharacterBundle(payload: unknown): unknown {
  if (!isPlainRecord(payload)) {
    return payload;
  }
  const characters = boundedItems({
    maxLength: CHARACTER_BUNDLE_CHARACTERS_MAX,
    value: payload.characters,
  });
  if (characters === null) {
    return payload;
  }
  const upgradedCharacters = characters.map((character) => upgradeLegacyBundleCharacter(character));
  if (
    !replacesAnyItem({ original: characters, upgraded: upgradedCharacters }) ||
    !fitsKeyLimit({ maxKeys: LEGACY_RECORD_MAX_KEYS.bundle, record: payload })
  ) {
    return payload;
  }
  return { ...payload, characters: upgradedCharacters };
}

function boundedItems({
  maxLength,
  value,
}: {
  maxLength: number;
  value: unknown;
}): Nullable<readonly unknown[]> {
  return Array.isArray(value) && value.length <= maxLength ? value : null;
}

function fitsKeyLimit({
  maxKeys,
  record,
}: {
  maxKeys: number;
  record: Record<string, unknown>;
}): boolean {
  return Object.keys(record).length <= maxKeys;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replacesAnyItem({
  original,
  upgraded,
}: {
  original: readonly unknown[];
  upgraded: readonly unknown[];
}): boolean {
  return upgraded.some((item, index) => item !== original[index]);
}

function upgradeLegacyBundleAppearance(appearance: unknown): unknown {
  if (!isPlainRecord(appearance)) {
    return appearance;
  }
  const isLegacyNarrator = appearance.narratorType === LEGACY_UNRELIABLE_NARRATOR_TYPE;
  if (
    (!isLegacyNarrator && !("hidePresenceAsSpoiler" in appearance)) ||
    !fitsKeyLimit({ maxKeys: LEGACY_RECORD_MAX_KEYS.appearance, record: appearance })
  ) {
    return appearance;
  }
  const { hidePresenceAsSpoiler: _retiredPresenceFlag, ...rest } = appearance;
  if (!isLegacyNarrator) {
    return rest;
  }
  return {
    ...rest,
    isUnreliableNarrator: true,
    isUnreliableNarratorSpoiler: false,
    narratorType: null,
  };
}

function upgradeLegacyBundleCharacter(character: unknown): unknown {
  if (!isPlainRecord(character)) {
    return character;
  }
  const appearances = boundedItems({
    maxLength: CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX,
    value: character.appearances,
  });
  if (appearances === null) {
    return character;
  }
  const upgradedAppearances = appearances.map((appearance) =>
    upgradeLegacyBundleAppearance(appearance),
  );
  const needsUpgrade =
    "hideProfileAsSpoiler" in character ||
    replacesAnyItem({ original: appearances, upgraded: upgradedAppearances });
  if (
    !needsUpgrade ||
    !fitsKeyLimit({ maxKeys: LEGACY_RECORD_MAX_KEYS.character, record: character })
  ) {
    return character;
  }
  const { hideProfileAsSpoiler: _retiredProfileFlag, ...rest } = character;
  return { ...rest, appearances: upgradedAppearances };
}

const V1FormatVersionProbeSchema = z.looseObject({
  formatVersion: z.literal(CHARACTER_BUNDLE_V1_FORMAT_VERSION),
});

export const CharacterBundleImportSchema = z
  .preprocess(upgradeV1CharacterBundle, CharacterBundleAnyVersionSchema)
  .transform((bundle) => ({
    bundle: toCurrentCharacterBundle(bundle),
    sourceFormatVersion: bundle.formatVersion,
  }));

export type ImportedCharacterBundle = z.infer<typeof CharacterBundleImportSchema>;

function toCurrentAttitude(
  attitude: Nullable<ImportableCharacterAttitude>,
): Nullable<CharacterAttitude> {
  return attitude === LEGACY_FAVORITE_ATTITUDE.value
    ? LEGACY_FAVORITE_ATTITUDE.replacement
    : attitude;
}

function toCurrentBundleCharacter(character: ImportableBundleCharacter): BundleCharacter {
  return {
    ...character,
    appearances: character.appearances.map((appearance) => ({
      ...appearance,
      attitude: toCurrentAttitude(appearance.attitude),
    })),
    globalAttitude: toCurrentAttitude(character.globalAttitude),
    isFavorite: character.isFavorite || character.globalAttitude === LEGACY_FAVORITE_ATTITUDE.value,
  };
}

function toCurrentCharacterBundle(
  bundle: CharacterBundleV1 | ImportableCharacterBundle,
): CharacterBundle {
  const characters =
    bundle.formatVersion === CHARACTER_BUNDLE_FORMAT_VERSION
      ? bundle.characters
      : bundle.characters.map((character) => withEmptyFacts(character));
  return {
    ...bundle,
    characters: characters.map((character) => toCurrentBundleCharacter(character)),
    formatVersion: CHARACTER_BUNDLE_FORMAT_VERSION,
  };
}

function upgradeV1CharacterBundle(payload: unknown): unknown {
  return V1FormatVersionProbeSchema.safeParse(payload).success
    ? upgradeLegacyCharacterBundle(payload)
    : payload;
}

function withEmptyFacts(character: BundleCharacterV1): ImportableBundleCharacter {
  return {
    ...character,
    appearances: character.appearances.map((appearance) => ({ ...appearance, facts: [] })),
  };
}

export const CharacterExportQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type CharacterExportQuery = z.infer<typeof CharacterExportQuerySchema>;

export const CharacterImportCreatedSchema = z.object({
  aliases: z.number().int().nonnegative(),
  appearances: z.number().int().nonnegative(),
  bookStates: z.number().int().nonnegative(),
  characters: z.number().int().nonnegative(),
  facts: z.number().int().nonnegative(),
  forms: z.number().int().nonnegative(),
  groups: z.number().int().nonnegative(),
  memberships: z.number().int().nonnegative(),
  relationships: z.number().int().nonnegative(),
  roles: z.number().int().nonnegative(),
  tags: z.number().int().nonnegative(),
  theories: z.number().int().nonnegative(),
});

export type CharacterImportCreated = z.infer<typeof CharacterImportCreatedSchema>;

export const CharacterImportSkippedSchema = z.object({
  aliasesMissingBook: z.number().int().nonnegative(),
  appearancesMissingBook: z.number().int().nonnegative(),
  bookStatesMissingBook: z.number().int().nonnegative(),
  factsMissingBook: z.number().int().nonnegative(),
  membershipsMissingBook: z.number().int().nonnegative(),
  relationshipsInvalid: z.number().int().nonnegative(),
  tagsMissing: z.number().int().nonnegative(),
  theoriesWithoutTarget: z.number().int().nonnegative(),
  unlinkedMedia: z.number().int().nonnegative(),
  unlinkedSeries: z.number().int().nonnegative(),
});

export type CharacterImportSkipped = z.infer<typeof CharacterImportSkippedSchema>;

export const CharacterImportResultViewSchema = z.object({
  created: CharacterImportCreatedSchema,
  formatVersion: z.number().int(),
  skipped: CharacterImportSkippedSchema,
});

export type CharacterImportResultView = z.infer<typeof CharacterImportResultViewSchema>;

import { z } from "zod";

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
  CharacterAttitudeSchema,
  CharacterEntityKindSchema,
  CharacterGenderSchema,
} from "./characters.js";

export const CHARACTER_BUNDLE_FORMAT_VERSION = 1;

const BUNDLE_NAME_MAX = 200;
const BUNDLE_SHORT_TEXT_MAX = 200;
const BUNDLE_SPECIES_MAX = 120;
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
export const CHARACTER_BUNDLE_ROLES_PER_APPEARANCE_MAX = 20;
export const CHARACTER_BUNDLE_TAGS_PER_CHARACTER_MAX = 15;
export const CHARACTER_BUNDLE_MEMBERS_PER_GROUP_MAX = 100;
export const CHARACTER_BUNDLE_BOOK_STATES_PER_RELATIONSHIP_MAX = 200;

export const CHARACTER_IMPORT_ERROR_CODES = {
  invalid: "character_import_invalid",
  tooLarge: "character_import_too_large",
} as const;

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const positionInt = z.number().int().min(0).max(CHARACTER_INT4_MAX);
const nullablePositiveInt = z.number().int().positive().max(CHARACTER_INT4_MAX).nullable();
const nullableNonNegativeInt = z.number().int().min(0).max(CHARACTER_INT4_MAX).nullable();
const externalRef = () => z.uuid();

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

const BundleAppearanceSchema = z
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
    hidePresenceAsSpoiler: z.boolean(),
    importance: BookCharacterImportanceSchema,
    isPovCharacter: z.boolean(),
    narratorType: BookCharacterNarratorTypeSchema.nullable(),
    personalImpression: nullableText(BUNDLE_LONG_TEXT_MAX),
    personalImpressionIsSpoiler: z.boolean(),
    portraitIsSpoiler: z.boolean(),
    portraitMediaId: externalRef().nullable(),
    roles: z.array(BundleRoleSchema).max(CHARACTER_BUNDLE_ROLES_PER_APPEARANCE_MAX),
    sortOrder: nullableNonNegativeInt,
    speciesOverride: nullableText(BUNDLE_SHORT_TEXT_MAX),
    speciesOverrideIsSpoiler: z.boolean(),
    status: BookCharacterStatusSchema,
    statusCustomText: nullableText(BUNDLE_SHORT_TEXT_MAX),
    statusIsSpoiler: z.boolean(),
  })
  .strict();

export type BundleAppearance = z.infer<typeof BundleAppearanceSchema>;

const BundleCharacterSchema = z
  .object({
    aliases: z.array(BundleAliasSchema).max(CHARACTER_BUNDLE_ALIASES_PER_CHARACTER_MAX),
    appearances: z
      .array(BundleAppearanceSchema)
      .max(CHARACTER_BUNDLE_APPEARANCES_PER_CHARACTER_MAX),
    avatarMediaId: externalRef().nullable(),
    customGender: nullableText(BUNDLE_GENDER_CUSTOM_MAX),
    entityKind: CharacterEntityKindSchema,
    gender: CharacterGenderSchema,
    globalAttitude: CharacterAttitudeSchema.nullable(),
    hideProfileAsSpoiler: z.boolean(),
    id: z.uuid(),
    isArchived: z.boolean(),
    isFavorite: z.boolean(),
    name: z.string().trim().min(1).max(BUNDLE_NAME_MAX),
    neutralDescription: nullableText(BUNDLE_LONG_TEXT_MAX),
    pronouns: nullableText(BUNDLE_PRONOUNS_MAX),
    species: nullableText(BUNDLE_SPECIES_MAX),
    tagIds: z.array(externalRef()).max(CHARACTER_BUNDLE_TAGS_PER_CHARACTER_MAX),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.gender === "custom" && (value.customGender ?? "").trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customGender is required when gender is custom",
        path: ["customGender"],
      });
    }
  });

export type BundleCharacter = z.infer<typeof BundleCharacterSchema>;

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
    memberships: z.array(BundleMembershipSchema).max(CHARACTER_BUNDLE_MEMBERS_PER_GROUP_MAX),
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
  });

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
    bookStates: z
      .array(BundleBookStateSchema)
      .max(CHARACTER_BUNDLE_BOOK_STATES_PER_RELATIONSHIP_MAX),
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
  });

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
  });

export type BundleTheory = z.infer<typeof BundleTheorySchema>;

export const CharacterBundleSchema = z
  .object({
    characters: z.array(BundleCharacterSchema).max(CHARACTER_BUNDLE_CHARACTERS_MAX),
    exportedAt: z.iso.datetime(),
    formatVersion: z.literal(CHARACTER_BUNDLE_FORMAT_VERSION),
    groups: z.array(BundleGroupSchema).max(CHARACTER_BUNDLE_GROUPS_MAX),
    relationships: z.array(BundleRelationshipSchema).max(CHARACTER_BUNDLE_RELATIONSHIPS_MAX),
    theories: z.array(BundleTheorySchema).max(CHARACTER_BUNDLE_THEORIES_MAX),
  })
  .strict()
  .superRefine((value, ctx) => {
    const characterIds = new Set<string>();
    for (const [index, character] of value.characters.entries()) {
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
    for (const [groupIndex, group] of value.groups.entries()) {
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
    for (const [index, relationship] of value.relationships.entries()) {
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
    for (const [index, theory] of value.theories.entries()) {
      if (theory.characterId !== null && !characterIds.has(theory.characterId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Theory references a character that is not part of the bundle",
          path: ["theories", index, "characterId"],
        });
      }
    }
  });

export type CharacterBundle = z.infer<typeof CharacterBundleSchema>;

export const CharacterExportQuerySchema = z.object({
  includeArchived: z.stringbool().default(true),
});

export type CharacterExportQuery = z.infer<typeof CharacterExportQuerySchema>;

export const CharacterImportCreatedSchema = z.object({
  aliases: z.number().int().nonnegative(),
  appearances: z.number().int().nonnegative(),
  bookStates: z.number().int().nonnegative(),
  characters: z.number().int().nonnegative(),
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

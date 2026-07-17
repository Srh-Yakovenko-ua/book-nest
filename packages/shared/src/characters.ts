import { z } from "zod";

import { createPaginatedSchema, LIST_PAGE_SIZE_MAX, PAGE_NUMBER_MAX } from "./common.js";
import { MediaViewSchema } from "./media.js";

const CHARACTER_NAME_MAX = 200;
const CHARACTER_SHORT_TEXT_MAX = 200;
const CHARACTER_SPECIES_MAX = 120;
const CHARACTER_GENDER_CUSTOM_MAX = 60;
const CHARACTER_PRONOUNS_MAX = 60;
const CHARACTER_LONG_TEXT_MAX = 5000;
const CHARACTER_SEARCH_MAX = 100;
const CHARACTER_ALIASES_MAX = 30;
const CHARACTER_ROLES_MAX = 20;
const CHARACTERS_DEFAULT_PAGE_SIZE = 20;

export const CHARACTER_INT4_MAX = 2147483647;

export const CHARACTER_ERROR_CODES = {
  alreadyLinkedToBook: "character_already_linked_to_book",
  bookNotFound: "character_book_not_found",
  mediaOwnershipMismatch: "media_ownership_mismatch",
  notFound: "character_not_found",
  ownershipMismatch: "character_ownership_mismatch",
  validationFailed: "validation_failed",
} as const;

export const CharacterEntityKindSchema = z.enum(["individual", "collective", "unknown"]);

export type CharacterEntityKind = z.infer<typeof CharacterEntityKindSchema>;

export const CharacterGenderSchema = z.enum([
  "female",
  "male",
  "non_binary",
  "agender_or_na",
  "unknown",
  "custom",
]);

export type CharacterGender = z.infer<typeof CharacterGenderSchema>;

export const CharacterAttitudeSchema = z.enum([
  "favorite",
  "like",
  "neutral",
  "distrust",
  "dislike",
  "hate",
  "unsure",
]);

export type CharacterAttitude = z.infer<typeof CharacterAttitudeSchema>;

export const CharacterAliasTypeSchema = z.enum([
  "nickname",
  "title",
  "pseudonym",
  "true_name",
  "former_name",
  "translation",
  "other",
]);

export type CharacterAliasType = z.infer<typeof CharacterAliasTypeSchema>;

export const BookCharacterImportanceSchema = z.enum([
  "central",
  "major",
  "supporting",
  "episodic",
  "mentioned",
]);

export type BookCharacterImportance = z.infer<typeof BookCharacterImportanceSchema>;

export const BookCharacterStatusSchema = z.enum([
  "active",
  "missing",
  "dead",
  "unknown",
  "transformed",
  "other",
]);

export type BookCharacterStatus = z.infer<typeof BookCharacterStatusSchema>;

export const BookCharacterNarratorTypeSchema = z.enum([
  "first_person",
  "third_person_limited",
  "third_person_omniscient",
  "unreliable",
  "other",
]);

export type BookCharacterNarratorType = z.infer<typeof BookCharacterNarratorTypeSchema>;

export const BookCharacterRoleTypeSchema = z.enum([
  "protagonist",
  "deuteragonist",
  "antagonist",
  "love_interest",
  "supporting",
  "episodic",
  "mentioned",
  "custom",
]);

export type BookCharacterRoleType = z.infer<typeof BookCharacterRoleTypeSchema>;

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const optionalInt4 = () => z.coerce.number().int().positive().max(CHARACTER_INT4_MAX).nullish();

const optionalNonNegativeInt4 = () =>
  z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).nullish();

const CharacterAliasInputSchema = z.object({
  bookId: z.string().uuid().nullish(),
  isSpoiler: z.boolean().default(false),
  name: z.string().trim().min(1).max(CHARACTER_NAME_MAX),
  position: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).optional(),
  type: CharacterAliasTypeSchema.default("nickname"),
});

const BookCharacterRoleInputSchema = z.object({
  customRole: optionalText(CHARACTER_SHORT_TEXT_MAX),
  isSpoiler: z.boolean().default(false),
  position: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).optional(),
  roleType: BookCharacterRoleTypeSchema,
});

export const CharacterInputSchema = z
  .object({
    aliases: z.array(CharacterAliasInputSchema).max(CHARACTER_ALIASES_MAX).default([]),
    avatarMediaId: z.string().uuid().nullish(),
    customGender: optionalText(CHARACTER_GENDER_CUSTOM_MAX),
    entityKind: CharacterEntityKindSchema.default("individual"),
    gender: CharacterGenderSchema.default("unknown"),
    globalAttitude: CharacterAttitudeSchema.nullish(),
    isFavorite: z.boolean().default(false),
    name: z.string().trim().min(1).max(CHARACTER_NAME_MAX),
    neutralDescription: optionalText(CHARACTER_LONG_TEXT_MAX),
    pronouns: optionalText(CHARACTER_PRONOUNS_MAX),
    species: optionalText(CHARACTER_SPECIES_MAX),
  })
  .superRefine((value, ctx) => {
    if (value.gender === "custom" && (value.customGender ?? "").trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customGender is required when gender is custom",
        path: ["customGender"],
      });
    }
  });

export type CharacterInput = z.infer<typeof CharacterInputSchema>;

export const BookCharacterProfileInputSchema = z.object({
  appearanceNotes: optionalText(CHARACTER_LONG_TEXT_MAX),
  appearanceNotesIsSpoiler: z.boolean().default(false),
  attitude: CharacterAttitudeSchema.nullish(),
  description: optionalText(CHARACTER_LONG_TEXT_MAX),
  descriptionIsSpoiler: z.boolean().default(false),
  displayName: optionalText(CHARACTER_SHORT_TEXT_MAX),
  displayNameIsSpoiler: z.boolean().default(false),
  firstAppearanceAudioSeconds: optionalNonNegativeInt4(),
  firstAppearanceChapter: optionalText(CHARACTER_SHORT_TEXT_MAX),
  firstAppearanceNote: optionalText(CHARACTER_SHORT_TEXT_MAX),
  firstAppearancePage: optionalInt4(),
  hidePresenceAsSpoiler: z.boolean().default(false),
  importance: BookCharacterImportanceSchema.default("supporting"),
  isPovCharacter: z.boolean().default(false),
  narratorType: BookCharacterNarratorTypeSchema.nullish(),
  personalImpression: optionalText(CHARACTER_LONG_TEXT_MAX),
  personalImpressionIsSpoiler: z.boolean().default(false),
  portraitIsSpoiler: z.boolean().default(false),
  portraitMediaId: z.string().uuid().nullish(),
  roles: z.array(BookCharacterRoleInputSchema).max(CHARACTER_ROLES_MAX).default([]),
  sortOrder: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).nullish(),
  speciesOverride: optionalText(CHARACTER_SHORT_TEXT_MAX),
  speciesOverrideIsSpoiler: z.boolean().default(false),
  status: BookCharacterStatusSchema.default("active"),
  statusCustomText: optionalText(CHARACTER_SHORT_TEXT_MAX),
  statusIsSpoiler: z.boolean().default(false),
});

export type BookCharacterProfileInput = z.infer<typeof BookCharacterProfileInputSchema>;

export const CreateCharacterSchema = z.object({
  character: CharacterInputSchema,
  firstAppearance: z
    .object({
      bookId: z.string().uuid(),
      bookProfile: BookCharacterProfileInputSchema,
    })
    .optional(),
});

export type CreateCharacter = z.infer<typeof CreateCharacterSchema>;

export const CreateCharacterInBookSchema = z.discriminatedUnion("mode", [
  z.object({
    bookProfile: BookCharacterProfileInputSchema,
    characterId: z.string().uuid(),
    mode: z.literal("existing"),
  }),
  z.object({
    bookProfile: BookCharacterProfileInputSchema,
    character: CharacterInputSchema,
    mode: z.literal("new"),
  }),
]);

export type CreateCharacterInBook = z.infer<typeof CreateCharacterInBookSchema>;

export const BookCharactersQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).max(PAGE_NUMBER_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(CHARACTERS_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(CHARACTER_SEARCH_MAX).optional(),
});

export type BookCharactersQuery = z.infer<typeof BookCharactersQuerySchema>;

const CharacterAliasViewSchema = z.object({
  bookId: z.string().nullable(),
  id: z.string(),
  isSpoiler: z.boolean(),
  name: z.string(),
  position: z.number().int(),
  type: CharacterAliasTypeSchema,
});

const BookCharacterRoleViewSchema = z.object({
  customRole: z.string().nullable(),
  id: z.string(),
  isSpoiler: z.boolean(),
  position: z.number().int(),
  roleType: BookCharacterRoleTypeSchema,
});

export const BookCharacterViewSchema = z.object({
  appearanceNotes: z.string().nullable(),
  appearanceNotesIsSpoiler: z.boolean(),
  attitude: CharacterAttitudeSchema.nullable(),
  bookId: z.string(),
  characterId: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  descriptionIsSpoiler: z.boolean(),
  displayName: z.string().nullable(),
  displayNameIsSpoiler: z.boolean(),
  firstAppearanceAudioSeconds: z.number().int().nullable(),
  firstAppearanceChapter: z.string().nullable(),
  firstAppearanceNote: z.string().nullable(),
  firstAppearancePage: z.number().int().nullable(),
  hiddenFields: z.array(z.string()),
  hidePresenceAsSpoiler: z.boolean(),
  id: z.string(),
  importance: BookCharacterImportanceSchema,
  isPovCharacter: z.boolean(),
  narratorType: BookCharacterNarratorTypeSchema.nullable(),
  personalImpression: z.string().nullable(),
  personalImpressionIsSpoiler: z.boolean(),
  portrait: MediaViewSchema.nullable(),
  portraitIsSpoiler: z.boolean(),
  roles: z.array(BookCharacterRoleViewSchema),
  sortOrder: z.number().int().nullable(),
  speciesOverride: z.string().nullable(),
  speciesOverrideIsSpoiler: z.boolean(),
  status: BookCharacterStatusSchema,
  statusCustomText: z.string().nullable(),
  statusIsSpoiler: z.boolean(),
  updatedAt: z.string(),
});

export type BookCharacterView = z.infer<typeof BookCharacterViewSchema>;

export const CharacterDetailsViewSchema = z.object({
  aliases: z.array(CharacterAliasViewSchema),
  appearances: z.array(BookCharacterViewSchema),
  archivedAt: z.string().nullable(),
  avatar: MediaViewSchema.nullable(),
  createdAt: z.string(),
  customGender: z.string().nullable(),
  entityKind: CharacterEntityKindSchema,
  gender: CharacterGenderSchema,
  globalAttitude: CharacterAttitudeSchema.nullable(),
  hiddenFields: z.array(z.string()),
  id: z.string(),
  isFavorite: z.boolean(),
  name: z.string(),
  neutralDescription: z.string().nullable(),
  pronouns: z.string().nullable(),
  species: z.string().nullable(),
  updatedAt: z.string(),
});

export type CharacterDetailsView = z.infer<typeof CharacterDetailsViewSchema>;

export const CharacterSummaryViewSchema = z.object({
  avatar: MediaViewSchema.nullable(),
  characterId: z.string(),
  displayName: z.string().nullable(),
  entityKind: CharacterEntityKindSchema,
  hiddenFields: z.array(z.string()),
  id: z.string(),
  importance: BookCharacterImportanceSchema,
  isFavorite: z.boolean(),
  name: z.string(),
  portrait: MediaViewSchema.nullable(),
  status: BookCharacterStatusSchema.nullable(),
});

export type CharacterSummaryView = z.infer<typeof CharacterSummaryViewSchema>;

export const PaginatedCharacterSummarySchema = createPaginatedSchema(CharacterSummaryViewSchema);

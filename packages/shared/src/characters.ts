import { z } from "zod";

import {
  createPaginatedSchema,
  LIST_PAGE_SIZE_MAX,
  PAGE_NUMBER_MAX,
  readingPositionQueryFields,
} from "./common.js";
import { queryStringArray } from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { TagViewSchema } from "./tags.js";

const CHARACTER_NAME_MAX = 200;
const CHARACTER_SHORT_TEXT_MAX = 200;
const CHARACTER_SPECIES_MAX = 120;
const CHARACTER_GENDER_CUSTOM_MAX = 60;
const CHARACTER_PRONOUNS_MAX = 60;
const CHARACTER_LONG_TEXT_MAX = 5000;
const CHARACTER_SEARCH_MAX = 100;
const CHARACTER_ALIASES_MAX = 30;
const CHARACTER_ROLES_MAX = 20;
const CHARACTER_TAGS_MAX = 15;
const CHARACTERS_DEFAULT_PAGE_SIZE = 20;

export const CHARACTER_INT4_MAX = 2147483647;

export const CHARACTER_SUGGESTIONS_LIMIT_DEFAULT = 10;
export const CHARACTER_SUGGESTIONS_LIMIT_MAX = 50;
export const CHARACTER_DUPLICATE_CANDIDATES_MAX = 20;

export const CHARACTER_ERROR_CODES = {
  alreadyLinkedToBook: "character_already_linked_to_book",
  bookNotFound: "character_book_not_found",
  mediaOwnershipMismatch: "media_ownership_mismatch",
  notFound: "character_not_found",
  ownershipMismatch: "character_ownership_mismatch",
  seriesNotFound: "character_series_not_found",
  tagNotFound: "character_tag_not_found",
  validationFailed: "validation_failed",
} as const;

export const CHARACTER_MERGE_ERROR_CODES = {
  conflict: "character_merge_conflict",
  notFound: "character_merge_not_found",
  sameCharacter: "character_merge_self",
} as const;

export const CHARACTER_FORM_ERROR_CODES = {
  characterNotFound: "character_form_character_not_found",
  duplicateName: "character_form_duplicate_name",
  mediaOwnershipMismatch: "media_ownership_mismatch",
  notFound: "character_form_not_found",
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

export const CharacterFormTypeSchema = z.enum([
  "reincarnation",
  "transformation",
  "alter_ego",
  "true_form",
  "disguise",
  "other",
]);

export type CharacterFormType = z.infer<typeof CharacterFormTypeSchema>;

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
    hideProfileAsSpoiler: z.boolean().default(false),
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

const CharacterAliasReplaceInputSchema = z
  .object({
    isSpoiler: z.boolean().default(false),
    name: z.string().trim().min(1).max(CHARACTER_NAME_MAX),
    position: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).optional(),
    type: CharacterAliasTypeSchema.default("nickname"),
  })
  .strict();

export const UpdateCharacterSchema = z
  .object({
    aliases: z.array(CharacterAliasReplaceInputSchema).max(CHARACTER_ALIASES_MAX).optional(),
    avatarMediaId: z.string().uuid().nullish(),
    customGender: optionalText(CHARACTER_GENDER_CUSTOM_MAX),
    entityKind: CharacterEntityKindSchema.optional(),
    gender: CharacterGenderSchema.optional(),
    globalAttitude: CharacterAttitudeSchema.nullish(),
    hideProfileAsSpoiler: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    name: z.string().trim().min(1).max(CHARACTER_NAME_MAX).optional(),
    neutralDescription: optionalText(CHARACTER_LONG_TEXT_MAX),
    pronouns: optionalText(CHARACTER_PRONOUNS_MAX),
    species: optionalText(CHARACTER_SPECIES_MAX),
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

export type UpdateCharacter = z.infer<typeof UpdateCharacterSchema>;

export const UpdateBookCharacterSchema = z
  .object({
    aliases: z.array(CharacterAliasReplaceInputSchema).max(CHARACTER_ALIASES_MAX).optional(),
    appearanceNotes: optionalText(CHARACTER_LONG_TEXT_MAX),
    appearanceNotesIsSpoiler: z.boolean().optional(),
    attitude: CharacterAttitudeSchema.nullish(),
    description: optionalText(CHARACTER_LONG_TEXT_MAX),
    descriptionIsSpoiler: z.boolean().optional(),
    displayName: optionalText(CHARACTER_SHORT_TEXT_MAX),
    displayNameIsSpoiler: z.boolean().optional(),
    firstAppearanceAudioSeconds: optionalNonNegativeInt4(),
    firstAppearanceChapter: optionalText(CHARACTER_SHORT_TEXT_MAX),
    firstAppearanceNote: optionalText(CHARACTER_SHORT_TEXT_MAX),
    firstAppearancePage: optionalInt4(),
    hidePresenceAsSpoiler: z.boolean().optional(),
    importance: BookCharacterImportanceSchema.optional(),
    isPovCharacter: z.boolean().optional(),
    narratorType: BookCharacterNarratorTypeSchema.nullish(),
    personalImpression: optionalText(CHARACTER_LONG_TEXT_MAX),
    personalImpressionIsSpoiler: z.boolean().optional(),
    portraitIsSpoiler: z.boolean().optional(),
    portraitMediaId: z.string().uuid().nullish(),
    roles: z.array(BookCharacterRoleInputSchema).max(CHARACTER_ROLES_MAX).optional(),
    sortOrder: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).nullish(),
    speciesOverride: optionalText(CHARACTER_SHORT_TEXT_MAX),
    speciesOverrideIsSpoiler: z.boolean().optional(),
    status: BookCharacterStatusSchema.optional(),
    statusCustomText: optionalText(CHARACTER_SHORT_TEXT_MAX),
    statusIsSpoiler: z.boolean().optional(),
    tagIds: z.array(z.string().uuid()).max(CHARACTER_TAGS_MAX).optional(),
  })
  .strict();

export type UpdateBookCharacter = z.infer<typeof UpdateBookCharacterSchema>;

export const CreateCharacterFormSchema = z
  .object({
    description: optionalText(CHARACTER_LONG_TEXT_MAX),
    formType: CharacterFormTypeSchema.default("other"),
    isSpoiler: z.boolean().default(false),
    name: z.string().trim().min(1).max(CHARACTER_NAME_MAX),
    portraitMediaId: z.string().uuid().nullish(),
    position: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).optional(),
  })
  .strict();

export type CreateCharacterForm = z.infer<typeof CreateCharacterFormSchema>;

export const UpdateCharacterFormSchema = z
  .object({
    description: optionalText(CHARACTER_LONG_TEXT_MAX),
    formType: CharacterFormTypeSchema.optional(),
    isSpoiler: z.boolean().optional(),
    name: z.string().trim().min(1).max(CHARACTER_NAME_MAX).optional(),
    portraitMediaId: z.string().uuid().nullish(),
    position: z.coerce.number().int().min(0).max(CHARACTER_INT4_MAX).optional(),
  })
  .strict();

export type UpdateCharacterForm = z.infer<typeof UpdateCharacterFormSchema>;

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

export const DeleteCharacterQuerySchema = z.object({
  confirm: z.literal("true"),
});

export type DeleteCharacterQuery = z.infer<typeof DeleteCharacterQuerySchema>;

export const CharacterDeletionResultSchema = z.object({
  characterId: z.string().uuid(),
  deletedAt: z.iso.datetime(),
  purgeAt: z.iso.datetime(),
});

export type CharacterDeletionResult = z.infer<typeof CharacterDeletionResultSchema>;

export const CharacterDeletionPreviewSchema = z.object({
  aliasCount: z.number().int(),
  appearanceCount: z.number().int(),
  roleCount: z.number().int(),
  tagCount: z.number().int(),
});

export type CharacterDeletionPreview = z.infer<typeof CharacterDeletionPreviewSchema>;

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
  status: BookCharacterStatusSchema.nullable(),
  statusCustomText: z.string().nullable(),
  statusIsSpoiler: z.boolean(),
  updatedAt: z.string(),
});

export type BookCharacterView = z.infer<typeof BookCharacterViewSchema>;

export const CharacterFormViewSchema = z.object({
  characterId: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  formType: CharacterFormTypeSchema,
  id: z.string(),
  isSpoiler: z.boolean(),
  name: z.string(),
  portrait: MediaViewSchema.nullable(),
  position: z.number().int(),
  updatedAt: z.string(),
});

export type CharacterFormView = z.infer<typeof CharacterFormViewSchema>;

export const CharacterFormListViewSchema = z.object({
  forms: z.array(CharacterFormViewSchema),
});

export type CharacterFormListView = z.infer<typeof CharacterFormListViewSchema>;

export const CharacterDetailsViewSchema = z.object({
  aliases: z.array(CharacterAliasViewSchema),
  appearances: z.array(BookCharacterViewSchema),
  archivedAt: z.string().nullable(),
  avatar: MediaViewSchema.nullable(),
  createdAt: z.string(),
  customGender: z.string().nullable(),
  entityKind: CharacterEntityKindSchema,
  forms: z.array(CharacterFormViewSchema),
  gender: CharacterGenderSchema,
  globalAttitude: CharacterAttitudeSchema.nullable(),
  hiddenFields: z.array(z.string()),
  hideProfileAsSpoiler: z.boolean(),
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

export const SeriesCharacterAppearanceViewSchema = z.object({
  attitude: CharacterAttitudeSchema.nullable(),
  attitudeChangedFromPrevious: z.boolean(),
  bookCharacterId: z.string(),
  bookId: z.string(),
  displayName: z.string().nullable(),
  hiddenFields: z.array(z.string()),
  importance: BookCharacterImportanceSchema,
  importanceChangedFromPrevious: z.boolean(),
  partNumber: z.number().int().nullable(),
  portrait: MediaViewSchema.nullable(),
  roles: z.array(BookCharacterRoleViewSchema),
  status: BookCharacterStatusSchema.nullable(),
  statusChangedFromPrevious: z.boolean(),
});

export type SeriesCharacterAppearanceView = z.infer<typeof SeriesCharacterAppearanceViewSchema>;

export const CharacterSeriesProfileViewSchema = z.object({
  aliases: z.array(CharacterAliasViewSchema),
  appearances: z.array(SeriesCharacterAppearanceViewSchema),
  avatar: MediaViewSchema.nullable(),
  characterId: z.string(),
  customGender: z.string().nullable(),
  entityKind: CharacterEntityKindSchema,
  gender: CharacterGenderSchema,
  globalAttitude: CharacterAttitudeSchema.nullable(),
  hiddenFields: z.array(z.string()),
  isFavorite: z.boolean(),
  name: z.string(),
  neutralDescription: z.string().nullable(),
  pronouns: z.string().nullable(),
  species: z.string().nullable(),
});

export type CharacterSeriesProfileView = z.infer<typeof CharacterSeriesProfileViewSchema>;

export const CharacterListSortSchema = z.enum(["name", "recently_added", "recently_updated"]);

export type CharacterListSort = z.infer<typeof CharacterListSortSchema>;

export const CharactersListQuerySchema = z.object({
  archived: z.stringbool().optional(),
  attitude: queryStringArray(CharacterAttitudeSchema),
  bookId: z.string().uuid().optional(),
  contextBookId: z.string().uuid().optional(),
  favorite: z.stringbool().optional(),
  gender: queryStringArray(CharacterGenderSchema),
  groupId: queryStringArray(z.string().uuid()),
  hasSpoilers: z.stringbool().optional(),
  importance: queryStringArray(BookCharacterImportanceSchema),
  includeHiddenProfiles: z.stringbool().optional(),
  includeSpoilerSearch: z.stringbool().optional(),
  pageNumber: z.coerce.number().int().min(1).max(PAGE_NUMBER_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(CHARACTERS_DEFAULT_PAGE_SIZE),
  possibleDuplicates: z.stringbool().optional(),
  q: z.string().trim().max(CHARACTER_SEARCH_MAX).optional(),
  role: queryStringArray(BookCharacterRoleTypeSchema),
  seriesId: z.string().uuid().optional(),
  sort: CharacterListSortSchema.default("name"),
  species: queryStringArray(z.string().trim().min(1).max(CHARACTER_SPECIES_MAX)),
  tagId: queryStringArray(z.string().uuid()),
});

export type CharactersListQuery = z.infer<typeof CharactersListQuerySchema>;

export const CharacterDuplicateCandidatesQuerySchema = z.object({
  aliases: queryStringArray(z.string().trim().min(1).max(CHARACTER_NAME_MAX)),
  characterId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(CHARACTER_NAME_MAX).optional(),
  seriesId: z.string().uuid().optional(),
});

export type CharacterDuplicateCandidatesQuery = z.infer<
  typeof CharacterDuplicateCandidatesQuerySchema
>;

export const CharacterSuggestionsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CHARACTER_SUGGESTIONS_LIMIT_MAX)
    .default(CHARACTER_SUGGESTIONS_LIMIT_DEFAULT),
  q: z.string().trim().max(CHARACTER_SEARCH_MAX).optional(),
});

export type CharacterSuggestionsQuery = z.infer<typeof CharacterSuggestionsQuerySchema>;

export const SeriesCharactersSortSchema = z.enum(["name", "importance"]);

export type SeriesCharactersSort = z.infer<typeof SeriesCharactersSortSchema>;

export const SeriesCharactersQuerySchema = z.object({
  contextBookId: z.string().uuid().optional(),
  includeFuture: z.stringbool().optional(),
  pageNumber: z.coerce.number().int().min(1).max(PAGE_NUMBER_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(CHARACTERS_DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(CHARACTER_SEARCH_MAX).optional(),
  sort: SeriesCharactersSortSchema.default("name"),
});

export type SeriesCharactersQuery = z.infer<typeof SeriesCharactersQuerySchema>;

export const SeriesCharacterProfileQuerySchema = z.object({
  contextBookId: z.string().uuid().optional(),
  includeFuture: z.stringbool().optional(),
});

export type SeriesCharacterProfileQuery = z.infer<typeof SeriesCharacterProfileQuerySchema>;

export const CharacterRevealFieldKeySchema = z.enum([
  "appearanceNotes",
  "description",
  "displayName",
  "personalImpression",
  "portrait",
  "speciesOverride",
  "status",
]);

export type CharacterRevealFieldKey = z.infer<typeof CharacterRevealFieldKeySchema>;

export const CharacterDetailsQuerySchema = z.object({
  ...readingPositionQueryFields,
  contextBookId: z.string().uuid().optional(),
  includeHiddenProfiles: z.stringbool().optional(),
  revealFieldIds: queryStringArray(CharacterRevealFieldKeySchema),
});

export type CharacterDetailsQuery = z.infer<typeof CharacterDetailsQuerySchema>;

export const SeriesReadingContextSourceSchema = z.enum([
  "last_finished_book",
  "first_book",
  "none",
]);

export type SeriesReadingContextSource = z.infer<typeof SeriesReadingContextSourceSchema>;

export const SeriesReadingContextDefaultViewSchema = z.object({
  contextBookId: z.string().nullable(),
  partNumber: z.number().int().nullable(),
  source: SeriesReadingContextSourceSchema,
});

export type SeriesReadingContextDefaultView = z.infer<typeof SeriesReadingContextDefaultViewSchema>;

export const CharacterGlobalSummaryViewSchema = z.object({
  appearanceCount: z.number().int(),
  archivedAt: z.string().nullable(),
  avatar: MediaViewSchema.nullable(),
  customGender: z.string().nullable(),
  entityKind: CharacterEntityKindSchema,
  gender: CharacterGenderSchema,
  globalAttitude: CharacterAttitudeSchema.nullable(),
  hideProfileAsSpoiler: z.boolean(),
  id: z.string(),
  isFavorite: z.boolean(),
  name: z.string(),
  neutralDescription: z.string().nullable(),
  pronouns: z.string().nullable(),
  species: z.string().nullable(),
  tags: z.array(TagViewSchema),
});

export type CharacterGlobalSummaryView = z.infer<typeof CharacterGlobalSummaryViewSchema>;

export const PaginatedCharacterGlobalSummarySchema = createPaginatedSchema(
  CharacterGlobalSummaryViewSchema,
);

export const CharacterDuplicateCandidatesViewSchema = z.object({
  candidates: z.array(CharacterGlobalSummaryViewSchema),
});

export type CharacterDuplicateCandidatesView = z.infer<
  typeof CharacterDuplicateCandidatesViewSchema
>;

export const CharacterSuggestionsViewSchema = z.object({
  suggestions: z.array(CharacterGlobalSummaryViewSchema),
});

export type CharacterSuggestionsView = z.infer<typeof CharacterSuggestionsViewSchema>;

export const CHARACTER_SUMMARY_TOP_LIMIT = 5;

export const BookCharacterImportanceCountsSchema = z.object({
  central: z.number().int().nonnegative(),
  episodic: z.number().int().nonnegative(),
  major: z.number().int().nonnegative(),
  mentioned: z.number().int().nonnegative(),
  supporting: z.number().int().nonnegative(),
});

export type BookCharacterImportanceCounts = z.infer<typeof BookCharacterImportanceCountsSchema>;

export const BookCharacterSummaryViewSchema = z.object({
  bookId: z.string(),
  byImportance: BookCharacterImportanceCountsSchema,
  favoritesCount: z.number().int().nonnegative(),
  hasHiddenRecords: z.boolean(),
  povCount: z.number().int().nonnegative(),
  top: z.array(CharacterSummaryViewSchema),
  totalVisibleCharacters: z.number().int().nonnegative(),
});

export type BookCharacterSummaryView = z.infer<typeof BookCharacterSummaryViewSchema>;

export const SeriesCharacterSummaryQuerySchema = z.object({
  contextBookId: z.string().uuid().optional(),
});

export type SeriesCharacterSummaryQuery = z.infer<typeof SeriesCharacterSummaryQuerySchema>;

export const SeriesCharacterSummaryViewSchema = z.object({
  byImportance: BookCharacterImportanceCountsSchema,
  contextBookId: z.string().nullable(),
  favoritesCount: z.number().int().nonnegative(),
  hasHiddenRecords: z.boolean(),
  povCount: z.number().int().nonnegative(),
  seriesId: z.string(),
  top: z.array(CharacterSummaryViewSchema),
  totalVisibleCharacters: z.number().int().nonnegative(),
});

export type SeriesCharacterSummaryView = z.infer<typeof SeriesCharacterSummaryViewSchema>;

export const CharacterMergePreviewQuerySchema = z
  .object({
    otherId: z.string().uuid(),
  })
  .strict();

export type CharacterMergePreviewQuery = z.infer<typeof CharacterMergePreviewQuerySchema>;

export const CharacterMergeInputSchema = z
  .object({
    otherId: z.string().uuid(),
  })
  .strict();

export type CharacterMergeInput = z.infer<typeof CharacterMergeInputSchema>;

export const CharacterMergeEntityCountsSchema = z.object({
  dropped: z.number().int().nonnegative(),
  moved: z.number().int().nonnegative(),
});

export type CharacterMergeEntityCounts = z.infer<typeof CharacterMergeEntityCountsSchema>;

export const CharacterMergeCountsSchema = z.object({
  aliases: CharacterMergeEntityCountsSchema,
  appearances: CharacterMergeEntityCountsSchema,
  forms: CharacterMergeEntityCountsSchema,
  memberships: CharacterMergeEntityCountsSchema,
  relationships: CharacterMergeEntityCountsSchema,
  roles: CharacterMergeEntityCountsSchema,
  tags: CharacterMergeEntityCountsSchema,
  theories: CharacterMergeEntityCountsSchema,
});

export type CharacterMergeCounts = z.infer<typeof CharacterMergeCountsSchema>;

export const CharacterMergePartySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type CharacterMergeParty = z.infer<typeof CharacterMergePartySchema>;

export const CharacterMergePreviewViewSchema = z.object({
  counts: CharacterMergeCountsSchema,
  hasHiddenRecords: z.boolean(),
  loser: CharacterMergePartySchema,
  survivor: CharacterMergePartySchema,
});

export type CharacterMergePreviewView = z.infer<typeof CharacterMergePreviewViewSchema>;

export const CharacterMergeResultViewSchema = z.object({
  counts: CharacterMergeCountsSchema,
  loserId: z.string(),
  survivor: CharacterMergePartySchema,
});

export type CharacterMergeResultView = z.infer<typeof CharacterMergeResultViewSchema>;

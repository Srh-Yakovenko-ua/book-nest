import { z } from "zod";

import { createPaginatedSchema, LIST_PAGE_SIZE_MAX, PAGE_NUMBER_MAX } from "./common.js";

const CHARACTER_GROUP_NAME_MAX = 200;
const CHARACTER_GROUP_CUSTOM_TYPE_MAX = 60;
const CHARACTER_GROUP_SHORT_TEXT_MAX = 200;
const CHARACTER_GROUP_LONG_TEXT_MAX = 5000;
const CHARACTER_GROUP_SEARCH_MAX = 100;
const CHARACTER_GROUPS_DEFAULT_PAGE_SIZE = 20;

export const CHARACTER_GROUP_MEMBERS_MAX = 100;

export const CHARACTER_GROUP_ERROR_CODES = {
  bookNotFound: "character_group_book_not_found",
  duplicateMember: "character_group_duplicate_member",
  memberCharacterNotFound: "character_group_member_character_not_found",
  membershipNotFound: "character_group_membership_not_found",
  notFound: "character_group_not_found",
  ownershipMismatch: "character_group_ownership_mismatch",
  seriesNotFound: "character_group_series_not_found",
  validationFailed: "validation_failed",
} as const;

export const CharacterGroupTypeSchema = z.enum([
  "family",
  "clan",
  "house",
  "court",
  "kingdom",
  "order",
  "guild",
  "team",
  "organization",
  "cult",
  "custom",
]);

export type CharacterGroupType = z.infer<typeof CharacterGroupTypeSchema>;

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const CharacterGroupMemberInputSchema = z
  .object({
    bookId: z.string().uuid().nullish(),
    characterId: z.string().uuid(),
    isSpoiler: z.boolean().default(false),
    role: optionalText(CHARACTER_GROUP_SHORT_TEXT_MAX),
    status: optionalText(CHARACTER_GROUP_SHORT_TEXT_MAX),
  })
  .strict();

export type CharacterGroupMemberInput = z.infer<typeof CharacterGroupMemberInputSchema>;

const requireCustomType = (
  value: { customType?: null | string; type?: CharacterGroupType },
  ctx: z.RefinementCtx,
): void => {
  if (value.type === "custom" && (value.customType ?? "").trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "customType is required when type is custom",
      path: ["customType"],
    });
  }
};

export const CreateCharacterGroupSchema = z
  .object({
    customType: optionalText(CHARACTER_GROUP_CUSTOM_TYPE_MAX),
    description: optionalText(CHARACTER_GROUP_LONG_TEXT_MAX),
    isSpoiler: z.boolean().default(false),
    members: z.array(CharacterGroupMemberInputSchema).max(CHARACTER_GROUP_MEMBERS_MAX).default([]),
    name: z.string().trim().min(1).max(CHARACTER_GROUP_NAME_MAX),
    seriesId: z.string().uuid().nullish(),
    type: CharacterGroupTypeSchema,
  })
  .strict()
  .superRefine(requireCustomType);

export type CreateCharacterGroup = z.infer<typeof CreateCharacterGroupSchema>;

export const UpdateCharacterGroupSchema = z
  .object({
    customType: optionalText(CHARACTER_GROUP_CUSTOM_TYPE_MAX),
    description: optionalText(CHARACTER_GROUP_LONG_TEXT_MAX),
    isSpoiler: z.boolean().optional(),
    name: z.string().trim().min(1).max(CHARACTER_GROUP_NAME_MAX).optional(),
    seriesId: z.string().uuid().nullish(),
    type: CharacterGroupTypeSchema.optional(),
  })
  .strict()
  .superRefine(requireCustomType);

export type UpdateCharacterGroup = z.infer<typeof UpdateCharacterGroupSchema>;

export const UpsertCharacterGroupMembershipSchema = z
  .object({
    bookId: z.string().uuid().nullish(),
    isSpoiler: z.boolean().default(false),
    role: optionalText(CHARACTER_GROUP_SHORT_TEXT_MAX),
    status: optionalText(CHARACTER_GROUP_SHORT_TEXT_MAX),
  })
  .strict();

export type UpsertCharacterGroupMembership = z.infer<typeof UpsertCharacterGroupMembershipSchema>;

export const CharacterGroupsListQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).max(PAGE_NUMBER_MAX).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(CHARACTER_GROUPS_DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(CHARACTER_GROUP_SEARCH_MAX).optional(),
  seriesId: z.string().uuid().optional(),
  type: CharacterGroupTypeSchema.optional(),
});

export type CharacterGroupsListQuery = z.infer<typeof CharacterGroupsListQuerySchema>;

export const CharacterGroupDetailsQuerySchema = z.object({
  contextBookId: z.string().uuid().optional(),
});

export type CharacterGroupDetailsQuery = z.infer<typeof CharacterGroupDetailsQuerySchema>;

export const CharacterGroupMembershipViewSchema = z.object({
  bookId: z.string().nullable(),
  characterId: z.string(),
  characterName: z.string(),
  createdAt: z.string(),
  id: z.string(),
  isSpoiler: z.boolean(),
  role: z.string().nullable(),
  status: z.string().nullable(),
  updatedAt: z.string(),
});

export type CharacterGroupMembershipView = z.infer<typeof CharacterGroupMembershipViewSchema>;

export const CharacterGroupSummaryViewSchema = z.object({
  createdAt: z.string(),
  customType: z.string().nullable(),
  description: z.string().nullable(),
  hiddenFields: z.array(z.string()),
  id: z.string(),
  isSpoiler: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  name: z.string().nullable(),
  seriesId: z.string().nullable(),
  type: CharacterGroupTypeSchema,
  updatedAt: z.string(),
});

export type CharacterGroupSummaryView = z.infer<typeof CharacterGroupSummaryViewSchema>;

export const PaginatedCharacterGroupSummarySchema = createPaginatedSchema(
  CharacterGroupSummaryViewSchema,
);

export const CharacterGroupDetailsViewSchema = CharacterGroupSummaryViewSchema.extend({
  members: z.array(CharacterGroupMembershipViewSchema),
});

export type CharacterGroupDetailsView = z.infer<typeof CharacterGroupDetailsViewSchema>;

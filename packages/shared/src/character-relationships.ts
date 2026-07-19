import { z } from "zod";

import { CHARACTER_INT4_MAX } from "./characters.js";
import { readingPositionQueryFields } from "./common.js";

const RELATIONSHIP_LABEL_MAX = 120;
const RELATIONSHIP_CUSTOM_TYPE_MAX = 60;
const RELATIONSHIP_DESCRIPTION_MAX = 5000;
const RELATIONSHIP_CHAPTER_MAX = 200;

export const RELATIONSHIP_INITIAL_BOOK_STATES_MAX = 50;

export const CHARACTER_RELATIONSHIP_ERROR_CODES = {
  bookContextInvalid: "relationship_book_context_invalid",
  bookNotFound: "relationship_book_not_found",
  bookStateNotFound: "relationship_book_state_not_found",
  characterNotFound: "relationship_character_not_found",
  directionMismatch: "relationship_direction_mismatch",
  duplicate: "relationship_duplicate",
  familyCycleDetected: "family_cycle_detected",
  notFound: "relationship_not_found",
  ownershipMismatch: "relationship_ownership_mismatch",
  selfReference: "relationship_self_reference",
  validationFailed: "validation_failed",
} as const;

export const RelationshipCategorySchema = z.enum([
  "family",
  "romantic",
  "social",
  "conflict",
  "mentorship",
  "hierarchy",
  "supernatural",
  "custom",
]);

export type RelationshipCategory = z.infer<typeof RelationshipCategorySchema>;

export const RelationshipDirectionalitySchema = z.enum(["directed", "symmetric"]);

export type RelationshipDirectionality = z.infer<typeof RelationshipDirectionalitySchema>;

export const RelationshipTypeSchema = z.enum([
  "biological_parent_of",
  "biological_child_of",
  "adoptive_parent_of",
  "adoptive_child_of",
  "step_parent_of",
  "step_child_of",
  "guardian_of",
  "ward_of",
  "ancestor_of",
  "descendant_of",
  "sibling_of",
  "half_sibling_of",
  "step_sibling_of",
  "twin_of",
  "spouse_of",
  "ex_spouse_of",
  "relative_of",
  "partner_of",
  "ex_partner_of",
  "romantic_interest_of",
  "mutual_romantic_interest",
  "engaged_to",
  "romantic_tension_with",
  "unrequited_love_for",
  "friend_of",
  "best_friend_of",
  "ally_of",
  "acquaintance_of",
  "companion_of",
  "neighbor_of",
  "trusted_by",
  "distrusts",
  "enemy_of",
  "rival_of",
  "betrayed",
  "betrayed_by",
  "hunts",
  "hunted_by",
  "opposes",
  "feud_with",
  "mentor_of",
  "student_of",
  "teacher_of",
  "pupil_of",
  "protector_of",
  "protected_by",
  "healer_of",
  "patient_of",
  "leader_of",
  "subordinate_of",
  "commander_of",
  "serves_under",
  "employer_of",
  "employee_of",
  "master_of",
  "servant_of",
  "member_of_same_group",
  "rules_over",
  "subject_of",
  "creator_of",
  "creation_of",
  "summoner_of",
  "summoned_by",
  "magically_bonded_to",
  "soulmate_of",
  "blood_bonded_to",
  "possesses",
  "possessed_by",
  "shares_body_with",
  "reincarnation_of",
  "clone_of",
  "custom",
]);

export type CatalogRelationshipType = Exclude<RelationshipType, "custom">;

export type FamilyAncestryRole = "ancestor" | "descendant";

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

type RelationshipTypeMeta = {
  category: Exclude<RelationshipCategory, "custom">;
  directionality: RelationshipDirectionality;
  familyRole?: FamilyAncestryRole;
};

const CATALOG_TYPE_META = {
  acquaintance_of: { category: "social", directionality: "symmetric" },
  adoptive_child_of: { category: "family", directionality: "directed", familyRole: "descendant" },
  adoptive_parent_of: { category: "family", directionality: "directed", familyRole: "ancestor" },
  ally_of: { category: "social", directionality: "symmetric" },
  ancestor_of: { category: "family", directionality: "directed", familyRole: "ancestor" },
  best_friend_of: { category: "social", directionality: "symmetric" },
  betrayed: { category: "conflict", directionality: "directed" },
  betrayed_by: { category: "conflict", directionality: "directed" },
  biological_child_of: { category: "family", directionality: "directed", familyRole: "descendant" },
  biological_parent_of: { category: "family", directionality: "directed", familyRole: "ancestor" },
  blood_bonded_to: { category: "supernatural", directionality: "symmetric" },
  clone_of: { category: "supernatural", directionality: "directed" },
  commander_of: { category: "hierarchy", directionality: "directed" },
  companion_of: { category: "social", directionality: "symmetric" },
  creation_of: { category: "supernatural", directionality: "directed" },
  creator_of: { category: "supernatural", directionality: "directed" },
  descendant_of: { category: "family", directionality: "directed", familyRole: "descendant" },
  distrusts: { category: "social", directionality: "directed" },
  employee_of: { category: "hierarchy", directionality: "directed" },
  employer_of: { category: "hierarchy", directionality: "directed" },
  enemy_of: { category: "conflict", directionality: "symmetric" },
  engaged_to: { category: "romantic", directionality: "symmetric" },
  ex_partner_of: { category: "romantic", directionality: "symmetric" },
  ex_spouse_of: { category: "family", directionality: "symmetric" },
  feud_with: { category: "conflict", directionality: "symmetric" },
  friend_of: { category: "social", directionality: "symmetric" },
  guardian_of: { category: "family", directionality: "directed", familyRole: "ancestor" },
  half_sibling_of: { category: "family", directionality: "symmetric" },
  healer_of: { category: "mentorship", directionality: "directed" },
  hunted_by: { category: "conflict", directionality: "directed" },
  hunts: { category: "conflict", directionality: "directed" },
  leader_of: { category: "hierarchy", directionality: "directed" },
  magically_bonded_to: { category: "supernatural", directionality: "symmetric" },
  master_of: { category: "hierarchy", directionality: "directed" },
  member_of_same_group: { category: "hierarchy", directionality: "symmetric" },
  mentor_of: { category: "mentorship", directionality: "directed" },
  mutual_romantic_interest: { category: "romantic", directionality: "symmetric" },
  neighbor_of: { category: "social", directionality: "symmetric" },
  opposes: { category: "conflict", directionality: "directed" },
  partner_of: { category: "romantic", directionality: "symmetric" },
  patient_of: { category: "mentorship", directionality: "directed" },
  possessed_by: { category: "supernatural", directionality: "directed" },
  possesses: { category: "supernatural", directionality: "directed" },
  protected_by: { category: "mentorship", directionality: "directed" },
  protector_of: { category: "mentorship", directionality: "directed" },
  pupil_of: { category: "mentorship", directionality: "directed" },
  reincarnation_of: { category: "supernatural", directionality: "directed" },
  relative_of: { category: "family", directionality: "symmetric" },
  rival_of: { category: "conflict", directionality: "symmetric" },
  romantic_interest_of: { category: "romantic", directionality: "directed" },
  romantic_tension_with: { category: "romantic", directionality: "symmetric" },
  rules_over: { category: "hierarchy", directionality: "directed" },
  servant_of: { category: "hierarchy", directionality: "directed" },
  serves_under: { category: "hierarchy", directionality: "directed" },
  shares_body_with: { category: "supernatural", directionality: "symmetric" },
  sibling_of: { category: "family", directionality: "symmetric" },
  soulmate_of: { category: "supernatural", directionality: "symmetric" },
  spouse_of: { category: "family", directionality: "symmetric" },
  step_child_of: { category: "family", directionality: "directed", familyRole: "descendant" },
  step_parent_of: { category: "family", directionality: "directed", familyRole: "ancestor" },
  step_sibling_of: { category: "family", directionality: "symmetric" },
  student_of: { category: "mentorship", directionality: "directed" },
  subject_of: { category: "hierarchy", directionality: "directed" },
  subordinate_of: { category: "hierarchy", directionality: "directed" },
  summoned_by: { category: "supernatural", directionality: "directed" },
  summoner_of: { category: "supernatural", directionality: "directed" },
  teacher_of: { category: "mentorship", directionality: "directed" },
  trusted_by: { category: "social", directionality: "directed" },
  twin_of: { category: "family", directionality: "symmetric" },
  unrequited_love_for: { category: "romantic", directionality: "directed" },
  ward_of: { category: "family", directionality: "directed", familyRole: "descendant" },
} as const satisfies Record<CatalogRelationshipType, RelationshipTypeMeta>;

export function getFamilyAncestryRole(type: RelationshipType): FamilyAncestryRole | undefined {
  if (type === "custom") {
    return undefined;
  }
  const meta: RelationshipTypeMeta = CATALOG_TYPE_META[type];
  return meta.familyRole;
}

export function getRelationshipTypeCategory(type: CatalogRelationshipType): RelationshipCategory {
  return CATALOG_TYPE_META[type].category;
}

export function getRelationshipTypeDirectionality(
  type: CatalogRelationshipType,
): RelationshipDirectionality {
  return CATALOG_TYPE_META[type].directionality;
}

export function isCatalogRelationshipType(type: RelationshipType): type is CatalogRelationshipType {
  return type !== "custom";
}

export const RELATIONSHIP_CATEGORY_TYPES: Record<RelationshipCategory, RelationshipType[]> =
  (() => {
    const grouped: Record<RelationshipCategory, RelationshipType[]> = {
      conflict: [],
      custom: ["custom"],
      family: [],
      hierarchy: [],
      mentorship: [],
      romantic: [],
      social: [],
      supernatural: [],
    };
    for (const type of RelationshipTypeSchema.options) {
      if (type === "custom") {
        continue;
      }
      grouped[CATALOG_TYPE_META[type].category].push(type);
    }
    return grouped;
  })();

export const RelationshipBookStateStatusSchema = z.enum(["active", "ended", "unknown", "hidden"]);

export type RelationshipBookStateStatus = z.infer<typeof RelationshipBookStateStatusSchema>;

export const RelationshipIntensitySchema = z.enum(["low", "medium", "high"]);

export type RelationshipIntensity = z.infer<typeof RelationshipIntensitySchema>;

export const RelationshipDiagnosticSeveritySchema = z.enum(["conflict", "warning"]);

export type RelationshipDiagnosticSeverity = z.infer<typeof RelationshipDiagnosticSeveritySchema>;

const optionalLabel = z.string().trim().max(RELATIONSHIP_LABEL_MAX).nullish();
const optionalChapter = z.string().trim().max(RELATIONSHIP_CHAPTER_MAX).nullish();
const optionalPositiveInt = z.coerce.number().int().positive().max(CHARACTER_INT4_MAX).nullish();

const relationshipBookStateFields = {
  description: z.string().trim().max(RELATIONSHIP_DESCRIPTION_MAX).nullish(),
  endedAudioSeconds: optionalPositiveInt,
  endedChapter: optionalChapter,
  endedPage: optionalPositiveInt,
  hideRelationshipAsSpoiler: z.boolean().default(false),
  intensity: RelationshipIntensitySchema.nullish(),
  introducedAudioSeconds: optionalPositiveInt,
  introducedChapter: optionalChapter,
  introducedPage: optionalPositiveInt,
  isDescriptionSpoiler: z.boolean().default(false),
  isTypeSpoiler: z.boolean().default(false),
  status: RelationshipBookStateStatusSchema.default("active"),
};

export const UpsertRelationshipBookStateSchema = z.object(relationshipBookStateFields).strict();

export type UpsertRelationshipBookState = z.infer<typeof UpsertRelationshipBookStateSchema>;

export const InitialRelationshipBookStateSchema = z
  .object({ ...relationshipBookStateFields, bookId: z.uuid() })
  .strict();

export type InitialRelationshipBookState = z.infer<typeof InitialRelationshipBookStateSchema>;

const requireCustomTypeConsistency = (
  value: {
    category?: RelationshipCategory;
    customType?: null | string;
    type?: RelationshipType;
  },
  ctx: z.RefinementCtx,
): void => {
  if (value.type === "custom" && (value.customType ?? "").trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "customType is required when type is custom",
      path: ["customType"],
    });
  }
  if (value.type === "custom" && value.category !== undefined && value.category !== "custom") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "category must be custom when type is custom",
      path: ["category"],
    });
  }
  if (value.category === "custom" && value.type !== undefined && value.type !== "custom") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "type must be custom when category is custom",
      path: ["type"],
    });
  }
  if (
    value.type !== undefined &&
    value.type !== "custom" &&
    value.category !== undefined &&
    value.category !== "custom" &&
    getRelationshipTypeCategory(value.type) !== value.category
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "type does not belong to the given category",
      path: ["type"],
    });
  }
};

export const CreateCharacterRelationshipSchema = z
  .object({
    allowFamilyCycle: z.boolean().default(false),
    category: RelationshipCategorySchema,
    customType: z.string().trim().max(RELATIONSHIP_CUSTOM_TYPE_MAX).nullish(),
    directionality: RelationshipDirectionalitySchema,
    initialBookStates: z
      .array(InitialRelationshipBookStateSchema)
      .max(RELATIONSHIP_INITIAL_BOOK_STATES_MAX)
      .default([]),
    isCanonical: z.boolean().default(false),
    sourceCharacterId: z.uuid(),
    sourceLabel: optionalLabel,
    targetCharacterId: z.uuid(),
    targetLabel: optionalLabel,
    type: RelationshipTypeSchema,
  })
  .strict()
  .superRefine(requireCustomTypeConsistency);

export type CreateCharacterRelationship = z.infer<typeof CreateCharacterRelationshipSchema>;

const requireAtLeastOneEdgeField = (
  value: {
    category?: RelationshipCategory;
    customType?: null | string;
    isCanonical?: boolean;
    sourceLabel?: null | string;
    targetLabel?: null | string;
    type?: RelationshipType;
  },
  ctx: z.RefinementCtx,
): void => {
  const changesNothing =
    value.category === undefined &&
    value.type === undefined &&
    value.customType === undefined &&
    value.sourceLabel === undefined &&
    value.targetLabel === undefined &&
    value.isCanonical === undefined;
  if (changesNothing) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An update must change at least one field",
      path: ["type"],
    });
  }
};

export const UpdateCharacterRelationshipSchema = z
  .object({
    allowFamilyCycle: z.boolean().default(false),
    category: RelationshipCategorySchema.optional(),
    customType: z.string().trim().max(RELATIONSHIP_CUSTOM_TYPE_MAX).nullish(),
    isCanonical: z.boolean().optional(),
    sourceLabel: optionalLabel,
    targetLabel: optionalLabel,
    type: RelationshipTypeSchema.optional(),
  })
  .strict()
  .superRefine(requireCustomTypeConsistency)
  .superRefine(requireAtLeastOneEdgeField);

export type UpdateCharacterRelationship = z.infer<typeof UpdateCharacterRelationshipSchema>;

export const CharacterRelationshipDetailsQuerySchema = z.object({
  ...readingPositionQueryFields,
  contextBookId: z.uuid().optional(),
});

export type CharacterRelationshipDetailsQuery = z.infer<
  typeof CharacterRelationshipDetailsQuerySchema
>;

export const BookCharacterRelationshipsQuerySchema = z.object({
  ...readingPositionQueryFields,
  includeHistory: z.stringbool().optional(),
});

export type BookCharacterRelationshipsQuery = z.infer<typeof BookCharacterRelationshipsQuerySchema>;

export const SeriesCharacterRelationshipsQuerySchema = z.object({
  ...readingPositionQueryFields,
  contextBookId: z.uuid().optional(),
  includeHistory: z.stringbool().optional(),
});

export type SeriesCharacterRelationshipsQuery = z.infer<
  typeof SeriesCharacterRelationshipsQuerySchema
>;

export const CharacterRelationshipBookStateViewSchema = z.object({
  bookId: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  descriptionHidden: z.boolean(),
  endedAudioSeconds: z.number().int().nullable(),
  endedChapter: z.string().nullable(),
  endedPage: z.number().int().nullable(),
  hideRelationshipAsSpoiler: z.boolean(),
  id: z.string(),
  intensity: RelationshipIntensitySchema.nullable(),
  introducedAudioSeconds: z.number().int().nullable(),
  introducedChapter: z.string().nullable(),
  introducedPage: z.number().int().nullable(),
  isDescriptionSpoiler: z.boolean(),
  isTypeSpoiler: z.boolean(),
  relationshipId: z.string(),
  status: RelationshipBookStateStatusSchema,
  updatedAt: z.string(),
});

export type CharacterRelationshipBookStateView = z.infer<
  typeof CharacterRelationshipBookStateViewSchema
>;

export const CharacterRelationshipViewSchema = z.object({
  category: RelationshipCategorySchema.nullable(),
  createdAt: z.string(),
  customType: z.string().nullable(),
  directionality: RelationshipDirectionalitySchema,
  id: z.string(),
  isCanonical: z.boolean(),
  sourceCharacterId: z.string(),
  sourceCharacterName: z.string(),
  sourceLabel: z.string().nullable(),
  targetCharacterId: z.string(),
  targetCharacterName: z.string(),
  targetLabel: z.string().nullable(),
  type: RelationshipTypeSchema.nullable(),
  typeHidden: z.boolean(),
  updatedAt: z.string(),
});

export type CharacterRelationshipView = z.infer<typeof CharacterRelationshipViewSchema>;

export const CharacterRelationshipDiagnosticViewSchema = z.object({
  characterIds: z.array(z.string()),
  code: z.string(),
  message: z.string(),
  severity: RelationshipDiagnosticSeveritySchema,
});

export type CharacterRelationshipDiagnosticView = z.infer<
  typeof CharacterRelationshipDiagnosticViewSchema
>;

export const CharacterRelationshipDetailsViewSchema = CharacterRelationshipViewSchema.extend({
  bookStates: z.array(CharacterRelationshipBookStateViewSchema),
  diagnostics: z.array(CharacterRelationshipDiagnosticViewSchema),
});

export type CharacterRelationshipDetailsView = z.infer<
  typeof CharacterRelationshipDetailsViewSchema
>;

export const CharacterRelationshipContextViewSchema = z.object({
  effectiveState: CharacterRelationshipBookStateViewSchema.nullable(),
  history: z.array(CharacterRelationshipBookStateViewSchema),
  relationship: CharacterRelationshipViewSchema,
});

export type CharacterRelationshipContextView = z.infer<
  typeof CharacterRelationshipContextViewSchema
>;

export const CharacterRelationshipDeletionResultViewSchema = z.object({
  bookStateCount: z.number().int().nonnegative(),
  id: z.string(),
});

export type CharacterRelationshipDeletionResultView = z.infer<
  typeof CharacterRelationshipDeletionResultViewSchema
>;

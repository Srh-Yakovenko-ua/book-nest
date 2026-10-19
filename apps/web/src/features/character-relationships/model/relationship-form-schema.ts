import type { Control, FieldErrors, FieldPath } from "react-hook-form";

import {
  CHARACTER_INT4_MAX,
  CreateCharacterRelationshipSchema,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
  UpsertRelationshipBookStateSchema,
} from "@app/shared";
import { z } from "zod";

import { parseAudioPosition } from "./relationship-audio-position";

type BoundedTextSchema = z.ZodOptional<z.ZodNullable<z.ZodString>>;

function maxLengthOf(schema: BoundedTextSchema): number {
  return schema.unwrap().unwrap().maxLength ?? Number.MAX_SAFE_INTEGER;
}

export const RELATIONSHIP_FORM_LIMITS = {
  chapterMax: maxLengthOf(UpsertRelationshipBookStateSchema.shape.introducedChapter),
  customTypeMax: maxLengthOf(CreateCharacterRelationshipSchema.shape.customType),
  descriptionMax: maxLengthOf(UpsertRelationshipBookStateSchema.shape.description),
  labelMax: maxLengthOf(CreateCharacterRelationshipSchema.shape.sourceLabel),
  positionMax: CHARACTER_INT4_MAX,
} as const;

export const RelationshipParticipantSchema = z.object({
  avatarUrl: z.string().nullable(),
  id: z.string(),
  name: z.string(),
});

export type RelationshipBookStateFormInput = RelationshipFormInput["bookState"];

export type RelationshipFormControl = Control<
  RelationshipFormInput,
  unknown,
  RelationshipFormValues
>;

export type RelationshipFormErrors = FieldErrors<RelationshipFormInput>;

export type RelationshipFormField = FieldPath<RelationshipFormInput>;

export type RelationshipFormInput = z.input<RelationshipFormSchema>;

export type RelationshipFormMessages = {
  audioInvalid: string;
  bookRequired: string;
  chapterTooLong: string;
  customTypeRequired: string;
  customTypeTooLong: string;
  descriptionTooLong: string;
  labelTooLong: string;
  pageInvalid: string;
  participantRequired: string;
  typeRequired: string;
};

export type RelationshipFormRules = {
  book: RelationshipFormRequirement;
  participants: RelationshipFormRequirement;
};

export type RelationshipFormValues = z.output<RelationshipFormSchema>;

export type RelationshipParticipant = z.infer<typeof RelationshipParticipantSchema>;

type RelationshipFormRequirement = "optional" | "required";

type RelationshipFormSchema = ReturnType<typeof buildRelationshipFormSchema>;

export const RELATIONSHIP_EDGE_FIELDS = [
  "category",
  "customType",
  "directionality",
  "isCanonical",
  "source",
  "sourceLabel",
  "target",
  "targetLabel",
  "type",
] as const satisfies readonly RelationshipFormField[];

const EDGE_FIELD_NAMES: ReadonlySet<RelationshipFormField> = new Set(RELATIONSHIP_EDGE_FIELDS);

export function buildRelationshipFormSchema({
  messages,
  rules,
}: {
  messages: RelationshipFormMessages;
  rules: RelationshipFormRules;
}) {
  const participant = RelationshipParticipantSchema.nullable().refine(
    (value) => rules.participants === "optional" || value !== null,
    { error: messages.participantRequired },
  );
  const label = z
    .string()
    .trim()
    .max(RELATIONSHIP_FORM_LIMITS.labelMax, { error: messages.labelTooLong });
  const chapter = z
    .string()
    .trim()
    .max(RELATIONSHIP_FORM_LIMITS.chapterMax, { error: messages.chapterTooLong });
  const page = z
    .number({ error: messages.pageInvalid })
    .int({ error: messages.pageInvalid })
    .positive({ error: messages.pageInvalid })
    .max(RELATIONSHIP_FORM_LIMITS.positionMax, { error: messages.pageInvalid })
    .nullable();
  const audio = z
    .string()
    .trim()
    .refine((value) => value === "" || (parseAudioPosition(value) ?? 0) > 0, {
      error: messages.audioInvalid,
    });

  return z
    .object({
      bookId: z
        .string()
        .nullable()
        .refine((value) => rules.book === "optional" || value !== null, {
          error: messages.bookRequired,
        }),
      bookState: z.object({
        description: z
          .string()
          .trim()
          .max(RELATIONSHIP_FORM_LIMITS.descriptionMax, { error: messages.descriptionTooLong }),
        endedAudio: audio,
        endedChapter: chapter,
        endedPage: page,
        hideRelationshipAsSpoiler: z.boolean(),
        intensity: RelationshipIntensitySchema.nullable(),
        introducedAudio: audio,
        introducedChapter: chapter,
        introducedPage: page,
        isDescriptionSpoiler: z.boolean(),
        isTypeSpoiler: z.boolean(),
        status: RelationshipBookStateStatusSchema,
      }),
      category: RelationshipCategorySchema,
      customType: z
        .string()
        .trim()
        .max(RELATIONSHIP_FORM_LIMITS.customTypeMax, { error: messages.customTypeTooLong }),
      directionality: RelationshipDirectionalitySchema,
      isCanonical: z.boolean(),
      source: participant,
      sourceLabel: label,
      target: participant,
      targetLabel: label,
      type: RelationshipTypeSchema.nullable().transform((value, context) => {
        if (value !== null) return value;
        context.issues.push({ code: "custom", input: value, message: messages.typeRequired });
        return z.NEVER;
      }),
    })
    .superRefine((values, context) => {
      if (values.type !== "custom" || values.customType.length > 0) return;
      context.addIssue({
        code: "custom",
        message: messages.customTypeRequired,
        path: ["customType"],
      });
    });
}

export function isRelationshipEdgeField(field: RelationshipFormField): boolean {
  return EDGE_FIELD_NAMES.has(field);
}

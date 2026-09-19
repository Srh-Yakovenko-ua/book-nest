import type {
  CreateNoteInput,
  CreateSeriesNoteInput,
  NoteBookPreview,
  NoteEntityType,
  NoteSeriesPreview,
  NoteView,
  Nullable,
  UpdateNoteInput,
} from "@app/shared";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { NOTE_INPUT_LIMITS, NoteCategorySchema } from "@app/shared";
import { z } from "zod";

import type { NoteEntityRef } from "./note-entity";

import { assertNever } from "./assert-never";
import { NOTE_CUSTOM_CATEGORY } from "./note-categories";

export type NoteCreateRequest =
  | { book: NoteBookPreview; input: CreateNoteInput; type: "book" }
  | { input: CreateSeriesNoteInput; series: NoteSeriesPreview; type: "series" };

export type NoteFormControl = Control<NoteFormInput, unknown, NoteFormValues>;

export type NoteFormErrors = FieldErrors<NoteFormInput>;

export type NoteFormInput = z.input<NoteFormSchema>;

export type NoteFormMessages = {
  chapterTooLong: string;
  customCategoryTooLong: string;
  entityRequired: string;
  pageNotPositive: string;
  textEmpty: string;
  textTooLong: string;
};

export type NoteFormRegister = UseFormRegister<NoteFormInput>;

export type NoteFormValues = z.output<NoteFormSchema>;

type NoteFormSchema = ReturnType<typeof buildNoteFormSchema>;

export function buildNoteFormSchema(messages: NoteFormMessages) {
  return z.object({
    category: NoteCategorySchema.optional(),
    chapter: z
      .string()
      .trim()
      .max(NOTE_INPUT_LIMITS.chapterMax, { error: messages.chapterTooLong }),
    customCategory: z
      .string()
      .trim()
      .max(NOTE_INPUT_LIMITS.customCategoryMax, { error: messages.customCategoryTooLong }),
    entity: z
      .custom<NoteEntityRef>()
      .nullable()
      .refine((entity) => entity !== null, { error: messages.entityRequired }),
    isFavorite: z.boolean(),
    isPinned: z.boolean(),
    isSavedLocationRemoved: z.boolean(),
    isSpoiler: z.boolean(),
    page: z
      .number()
      .int()
      .positive({ error: messages.pageNotPositive })
      .max(NOTE_INPUT_LIMITS.pageMax, { error: messages.pageNotPositive })
      .optional(),
    text: z
      .string()
      .trim()
      .min(1, { error: messages.textEmpty })
      .max(NOTE_INPUT_LIMITS.textMax, { error: messages.textTooLong }),
  });
}

export function noteCreateRequest(values: NoteFormValues): NoteCreateRequest {
  const { entity } = values;

  switch (entity.type) {
    case "book":
      return {
        book: entity.book,
        input: { ...noteOwnedInput(values), ...bookLocationInput(values) },
        type: "book",
      };
    case "series":
      return { input: noteOwnedInput(values), series: entity.series, type: "series" };
    default:
      return assertNever(entity);
  }
}

export function noteFormDefaults({
  entity,
  note,
}: {
  entity: Nullable<NoteEntityRef>;
  note?: NoteView;
}): NoteFormInput {
  return {
    category: note?.category ?? undefined,
    chapter: note?.chapter ?? "",
    customCategory: note?.customCategory ?? "",
    entity,
    isFavorite: note?.isFavorite ?? false,
    isPinned: note?.isPinned ?? false,
    isSavedLocationRemoved: false,
    isSpoiler: note?.isSpoiler ?? false,
    page: note?.page ?? undefined,
    text: note?.text ?? "",
  };
}

export function noteUpdateInput(
  entityType: NoteEntityType,
  values: NoteFormValues,
): UpdateNoteInput {
  switch (entityType) {
    case "book":
      return { ...noteOwnedInput(values), ...bookLocationInput(values) };
    case "series":
      return values.isSavedLocationRemoved
        ? { ...noteOwnedInput(values), chapter: null, page: null }
        : noteOwnedInput(values);
    default:
      return assertNever(entityType);
  }
}

function bookLocationInput(values: NoteFormValues): Pick<CreateNoteInput, "chapter" | "page"> {
  const chapter = values.chapter.trim();

  return {
    chapter: chapter.length > 0 ? chapter : null,
    page: values.page ?? null,
  };
}

function noteOwnedInput(values: NoteFormValues): CreateSeriesNoteInput {
  const customCategory =
    values.category === NOTE_CUSTOM_CATEGORY ? values.customCategory.trim() : "";

  return {
    category: values.category ?? null,
    customCategory: customCategory.length > 0 ? customCategory : null,
    isFavorite: values.isFavorite,
    isPinned: values.isPinned,
    isSpoiler: values.isSpoiler,
    text: values.text.trim(),
  };
}

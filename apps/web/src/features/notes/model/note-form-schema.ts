import type { CreateNoteInput } from "@app/shared";

import { NOTE_PAGE_MAX, NoteCategorySchema } from "@app/shared";
import { z } from "zod";

import { NOTE_CUSTOM_CATEGORY } from "./note-categories";

export const NOTE_TEXT_MAX = 5000;
export const NOTE_CHAPTER_MAX = 100;
export const NOTE_CUSTOM_CATEGORY_MAX = 100;

export type NoteFormMessages = {
  chapterTooLong: string;
  customCategoryTooLong: string;
  pageNotPositive: string;
  textEmpty: string;
  textTooLong: string;
};

export type NoteFormValues = z.infer<ReturnType<typeof buildNoteFormSchema>>;

export function buildNoteFormSchema(messages: NoteFormMessages) {
  return z.object({
    category: NoteCategorySchema.optional(),
    chapter: z.string().trim().max(NOTE_CHAPTER_MAX, { error: messages.chapterTooLong }),
    customCategory: z
      .string()
      .trim()
      .max(NOTE_CUSTOM_CATEGORY_MAX, { error: messages.customCategoryTooLong }),
    isFavorite: z.boolean(),
    isPinned: z.boolean(),
    isSpoiler: z.boolean(),
    page: z
      .number()
      .int()
      .positive({ error: messages.pageNotPositive })
      .max(NOTE_PAGE_MAX, { error: messages.pageNotPositive })
      .optional(),
    text: z
      .string()
      .trim()
      .min(1, { error: messages.textEmpty })
      .max(NOTE_TEXT_MAX, { error: messages.textTooLong }),
  });
}

export function noteFormValuesToInput(values: NoteFormValues): CreateNoteInput {
  const isOther = values.category === NOTE_CUSTOM_CATEGORY;
  const customCategory = isOther ? values.customCategory.trim() : "";
  const chapter = values.chapter.trim();

  return {
    category: values.category ?? null,
    chapter: chapter.length > 0 ? chapter : null,
    customCategory: customCategory.length > 0 ? customCategory : null,
    isFavorite: values.isFavorite,
    isPinned: values.isPinned,
    isSpoiler: values.isSpoiler,
    page: values.page ?? null,
    text: values.text.trim(),
  };
}

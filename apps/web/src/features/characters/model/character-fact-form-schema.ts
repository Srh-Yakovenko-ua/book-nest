import type {
  CharacterFactView,
  CreateCharacterFactInput,
  Nullable,
  UpdateCharacterFactInput,
} from "@app/shared";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { CHARACTER_FACT_INPUT_LIMITS, CreateCharacterFactInputSchema } from "@app/shared";
import { z } from "zod";

import type { BookPageCeiling } from "@/features/books/model/book-page-ceiling";

export type CharacterFactFormControl = Control<
  CharacterFactFormInput,
  unknown,
  CharacterFactFormValues
>;

export type CharacterFactFormErrors = FieldErrors<CharacterFactFormInput>;

export type CharacterFactFormInput = z.input<CharacterFactFormSchema>;

export type CharacterFactFormMessages = {
  chapterTooLong: string;
  pageExceedsBook: string;
  pageNotPositive: string;
  pageTooLarge: string;
  textRequired: string;
  textTooLong: string;
  titleRequired: string;
  titleTooLong: string;
};

export type CharacterFactFormRegister = UseFormRegister<CharacterFactFormInput>;

export type CharacterFactFormTarget =
  { fact: CharacterFactView; mode: "edit" } | { mode: "create" };

export type CharacterFactFormValues = z.output<CharacterFactFormSchema>;

type CharacterFactFormSchema = ReturnType<typeof buildCharacterFactFormSchema>;

export function buildCharacterFactFormSchema(
  messages: CharacterFactFormMessages,
  pageCeiling: BookPageCeiling,
) {
  return z.object({
    chapter: z
      .string()
      .trim()
      .max(CHARACTER_FACT_INPUT_LIMITS.chapterMax, { error: messages.chapterTooLong }),
    page: z
      .number({ error: messages.pageNotPositive })
      .int({ error: messages.pageNotPositive })
      .positive({ error: messages.pageNotPositive })
      .max(pageCeiling.max, {
        error: pageCeiling.source === "book" ? messages.pageExceedsBook : messages.pageTooLarge,
      })
      .nullable(),
    text: z
      .string()
      .trim()
      .min(1, { error: messages.textRequired })
      .max(CHARACTER_FACT_INPUT_LIMITS.textMax, { error: messages.textTooLong }),
    title: z
      .string()
      .trim()
      .min(1, { error: messages.titleRequired })
      .max(CHARACTER_FACT_INPUT_LIMITS.titleMax, { error: messages.titleTooLong }),
  });
}

export function characterFactFormDefaults(target: CharacterFactFormTarget): CharacterFactFormInput {
  if (target.mode === "create") return { chapter: "", page: null, text: "", title: "" };

  const { fact } = target;
  return { chapter: fact.chapter ?? "", page: fact.page, text: fact.text, title: fact.title };
}

export function toCreateCharacterFactInput(
  values: CharacterFactFormValues,
): CreateCharacterFactInput {
  return CreateCharacterFactInputSchema.parse(values);
}

export function toUpdateCharacterFactInput(
  fact: CharacterFactView,
  values: CharacterFactFormValues,
): Nullable<UpdateCharacterFactInput> {
  const next = CreateCharacterFactInputSchema.parse(values);
  const changes: UpdateCharacterFactInput = {
    ...(next.chapter === fact.chapter ? {} : { chapter: next.chapter }),
    ...(next.page === fact.page ? {} : { page: next.page }),
    ...(next.text === fact.text ? {} : { text: next.text }),
    ...(next.title === fact.title ? {} : { title: next.title }),
  };

  return Object.keys(changes).length === 0 ? null : changes;
}

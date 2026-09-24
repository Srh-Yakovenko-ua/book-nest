import type { CreateCharacterInBook } from "@app/shared";

import { z } from "zod";

import {
  CHARACTER_NAME_MAX,
  emptyCharacterFormValues,
  toBookProfileInput,
  toCharacterInput,
} from "./character-form-schema";

export const ADD_CHARACTER_DESCRIPTION_MAX = 5000;

export type AddCharacterMessages = {
  nameRequired: string;
  nameTooLong: string;
};

export type AddCharacterValues = z.infer<ReturnType<typeof buildAddCharacterSchema>>;

export function buildAddCharacterSchema(messages: AddCharacterMessages) {
  return z.object({
    description: z.string().max(ADD_CHARACTER_DESCRIPTION_MAX),
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(CHARACTER_NAME_MAX, messages.nameTooLong),
  });
}

export function emptyAddCharacterValues(name = ""): AddCharacterValues {
  return { description: "", name };
}

export function toCreateNewCharacterInBook(
  values: AddCharacterValues,
  bookId: string,
): CreateCharacterInBook {
  const formValues = {
    ...emptyCharacterFormValues({ name: values.name }),
    description: values.description,
  };

  return {
    bookProfile: toBookProfileInput(formValues),
    character: toCharacterInput(formValues, bookId),
    mode: "new",
  };
}

export function toLinkExistingCharacterInBook(characterId: string): CreateCharacterInBook {
  return {
    bookProfile: toBookProfileInput(emptyCharacterFormValues()),
    characterId,
    mode: "existing",
  };
}

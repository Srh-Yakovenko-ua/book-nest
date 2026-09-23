import {
  collapseSpaces,
  TAG_DESCRIPTION_MAX,
  TAG_NAME_ALLOWED_CHARS,
  TAG_NAME_MAX,
  TAG_NAME_MIN,
  TagTypeSchema,
} from "@app/shared";
import { z } from "zod";

import { TagColorSchema } from "./tag-color";

export type TagFormMessages = {
  descriptionTooLong: string;
  nameInvalidChars: string;
  nameRequired: string;
  nameTooLong: string;
  nameTooShort: string;
};

export type TagFormValues = z.output<ReturnType<typeof createTagFormSchema>>;

export function createTagFormSchema(messages: TagFormMessages) {
  return z.object({
    color: TagColorSchema,
    description: z
      .string()
      .trim()
      .pipe(z.string().max(TAG_DESCRIPTION_MAX, messages.descriptionTooLong)),
    name: z
      .string()
      .transform(collapseSpaces)
      .pipe(
        z
          .string()
          .min(1, messages.nameRequired)
          .min(TAG_NAME_MIN, messages.nameTooShort)
          .max(TAG_NAME_MAX, messages.nameTooLong)
          .regex(TAG_NAME_ALLOWED_CHARS, messages.nameInvalidChars),
      ),
    type: TagTypeSchema,
  });
}

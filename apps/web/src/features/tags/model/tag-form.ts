import type { TagCatalogListItem, UpdateTagInput } from "@app/shared";

import {
  collapseSpaces,
  TAG_DESCRIPTION_MAX,
  TAG_NAME_ALLOWED_CHARS,
  TAG_NAME_MAX,
  TAG_NAME_MIN,
  TagColorSchema,
  TagTypeSchema,
} from "@app/shared";
import { z } from "zod";

import { ApiError } from "@/lib/http-client";

const DUPLICATE_TAG_NAME_STATUS = 409;

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

export function isDuplicateTagNameError(error: unknown): boolean {
  return error instanceof ApiError && error.status === DUPLICATE_TAG_NAME_STATUS;
}

export function toTagUpdatePatch(
  values: TagFormValues,
  original: Pick<TagCatalogListItem, "color" | "description" | "name" | "type">,
): UpdateTagInput {
  const description = values.description === "" ? null : values.description;

  return {
    ...(values.name === original.name ? {} : { name: values.name }),
    ...(values.type === original.type ? {} : { type: values.type }),
    ...(values.color === original.color ? {} : { color: values.color }),
    ...(description === original.description ? {} : { description }),
  };
}

import { z } from "zod";

import { collapseSpaces, normalizeName } from "./common.js";
import { NoHtmlString } from "./internal.js";

export const TAG_NAME_MIN = 2;
export const TAG_NAME_MAX = 30;
const BOOK_TAGS_MAX = 12;

export const TAG_NAME_ALLOWED_CHARS = /^[\p{L}\p{N} '’-]+$/u;

export const TagNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(TAG_NAME_MIN, "Tag must be at least 2 characters long")
      .max(TAG_NAME_MAX, "Tag must be at most 30 characters long")
      .regex(
        TAG_NAME_ALLOWED_CHARS,
        "Tag may contain only letters, digits, spaces, hyphens and apostrophes",
      ),
  );

export const BookTagsInputSchema = z
  .array(TagNameSchema)
  .max(BOOK_TAGS_MAX, "You can add at most 12 tags")
  .refine((tags) => {
    const seen = new Set(tags.map(normalizeName));
    return seen.size === tags.length;
  }, "Tags must not contain duplicates");

export const TagViewSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type TagView = z.infer<typeof TagViewSchema>;

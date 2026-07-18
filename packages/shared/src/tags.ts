import { z } from "zod";

import { collapseSpaces, normalizeName } from "./common.js";
import { NoHtmlString } from "./internal.js";

export const TAG_NAME_MIN = 2;
export const TAG_NAME_MAX = 40;
export const TAG_DESCRIPTION_MAX = 300;
export const TAG_COLOR_MAX = 32;
const BOOK_TAGS_MAX = 15;

export const TAG_NAME_ALLOWED_CHARS = /^[\p{L}\p{N} '’-]+$/u;
export const TAG_COLOR_ALLOWED_CHARS = /^[#a-zA-Z0-9_-]+$/;

export const TagTypeSchema = z.enum([
  "trope",
  "atmosphere",
  "theme",
  "character",
  "format",
  "custom",
]);

export type TagType = z.infer<typeof TagTypeSchema>;

export const DEFAULT_TAG_TYPE: TagType = "custom";

export const TagNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(TAG_NAME_MIN, "Tag must be at least 2 characters long")
      .max(TAG_NAME_MAX, "Tag must be at most 40 characters long")
      .regex(
        TAG_NAME_ALLOWED_CHARS,
        "Tag may contain only letters, digits, spaces, hyphens and apostrophes",
      ),
  );

export const TagColorSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, "Color must not be empty")
      .max(TAG_COLOR_MAX, "Color must be at most 32 characters long")
      .regex(TAG_COLOR_ALLOWED_CHARS, "Color must be a hex value or palette token"),
  );

export const TagDescriptionSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(NoHtmlString.max(TAG_DESCRIPTION_MAX, "Description must be at most 300 characters long"));

export const CreateTagSchema = z.object({
  color: TagColorSchema.optional(),
  description: TagDescriptionSchema.optional(),
  name: TagNameSchema,
  type: TagTypeSchema.default(DEFAULT_TAG_TYPE),
});

export type CreateTagInput = z.infer<typeof CreateTagSchema>;

export const UpdateTagSchema = z
  .object({
    color: TagColorSchema.nullable(),
    description: TagDescriptionSchema.nullable(),
    name: TagNameSchema,
    type: TagTypeSchema,
  })
  .partial()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdateTagInput = z.infer<typeof UpdateTagSchema>;

export const BookTagsInputSchema = z
  .array(TagNameSchema)
  .max(BOOK_TAGS_MAX, "You can add at most 15 tags")
  .refine((tags) => {
    const seen = new Set(tags.map(normalizeName));
    return seen.size === tags.length;
  }, "Tags must not contain duplicates");

export const TagViewSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type TagView = z.infer<typeof TagViewSchema>;

export const TagCatalogViewSchema = z.object({
  color: z.string().nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.string(),
  lastUsedAt: z.string().nullable(),
  name: z.string(),
  normalizedName: z.string(),
  type: TagTypeSchema,
  updatedAt: z.string(),
});

export type TagCatalogView = z.infer<typeof TagCatalogViewSchema>;

export const TagStatsViewSchema = z.object({
  booksCount: z.number().int(),
  color: z.string().nullable(),
  description: z.string().nullable(),
  id: z.string(),
  lastUsedAt: z.string().nullable(),
  name: z.string(),
  normalizedName: z.string(),
  type: TagTypeSchema,
});

export type TagStatsView = z.infer<typeof TagStatsViewSchema>;

import { z } from "zod";

import { CHARACTER_INT4_MAX } from "./characters.js";
import {
  createPaginatedSchema,
  normalizeSearch,
  type Nullable,
  paginationQueryFields,
} from "./common.js";

export const CHARACTER_FACTS_PAGE_SIZE = 20;

export const CHARACTER_FACT_INPUT_LIMITS = {
  chapterMax: 100,
  pageMax: CHARACTER_INT4_MAX,
  searchMax: 100,
  textMax: 5000,
  titleMax: 120,
} as const;

export const CHARACTER_FACT_ERROR_CODES = {
  notFound: "character_fact_not_found",
  pageExceedsBook: "character_fact_page_exceeds_book",
} as const;

export const CHARACTER_FACT_FIELDS = {
  chapterText: z.string().trim().max(CHARACTER_FACT_INPUT_LIMITS.chapterMax),
  pageChecks: [z.int(), z.positive(), z.lte(CHARACTER_FACT_INPUT_LIMITS.pageMax)],
  text: z.string().trim().min(1).max(CHARACTER_FACT_INPUT_LIMITS.textMax),
  title: z.string().trim().min(1).max(CHARACTER_FACT_INPUT_LIMITS.titleMax),
} as const;

const characterFactTitle = CHARACTER_FACT_FIELDS.title;

const characterFactText = CHARACTER_FACT_FIELDS.text;

const characterFactChapter = CHARACTER_FACT_FIELDS.chapterText
  .transform((chapter): Nullable<string> => (chapter.length === 0 ? null : chapter))
  .nullish();

const characterFactPage = z.coerce
  .number()
  .check(...CHARACTER_FACT_FIELDS.pageChecks)
  .nullish();

export const CreateCharacterFactInputSchema = z
  .object({
    chapter: characterFactChapter,
    page: characterFactPage,
    text: characterFactText,
    title: characterFactTitle,
  })
  .strict();

export type CreateCharacterFactInput = z.infer<typeof CreateCharacterFactInputSchema>;

export const UpdateCharacterFactInputSchema = z
  .object({
    chapter: characterFactChapter,
    page: characterFactPage,
    text: characterFactText.optional(),
    title: characterFactTitle.optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((fieldValue) => fieldValue !== undefined), {
    message: "An update must change at least one field",
  });

export type UpdateCharacterFactInput = z.infer<typeof UpdateCharacterFactInputSchema>;

export const CharacterFactViewSchema = z.object({
  chapter: z.string().nullable(),
  createdAt: z.iso.datetime(),
  id: z.string(),
  page: z.number().int().nullable(),
  text: z.string(),
  title: z.string(),
  updatedAt: z.iso.datetime(),
});

export type CharacterFactView = z.infer<typeof CharacterFactViewSchema>;

export const PaginatedCharacterFactsSchema = createPaginatedSchema(CharacterFactViewSchema);

export type PaginatedCharacterFacts = z.infer<typeof PaginatedCharacterFactsSchema>;

export const CharacterFactsQuerySchema = z.object({
  ...paginationQueryFields({
    pageSizeDefault: CHARACTER_FACTS_PAGE_SIZE,
    pageSizeMax: CHARACTER_FACTS_PAGE_SIZE,
  }),
  q: z
    .string()
    .trim()
    .max(CHARACTER_FACT_INPUT_LIMITS.searchMax)
    .transform(normalizeSearch)
    .optional(),
});

export type CharacterFactsQuery = z.infer<typeof CharacterFactsQuerySchema>;

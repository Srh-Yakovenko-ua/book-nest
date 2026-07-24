import { z } from "zod";

import { createPaginatedSchema, paginationQueryFields } from "./common.js";

const CHARACTER_THEORY_TEXT_MAX = 5000;
const CHARACTER_THEORY_SEARCH_MAX = 100;
const CHARACTER_THEORIES_DEFAULT_PAGE_SIZE = 20;

export const CHARACTER_THEORY_ERROR_CODES = {
  bookNotFound: "character_theory_book_not_found",
  characterNotFound: "character_theory_character_not_found",
  notFound: "character_theory_not_found",
  seriesNotFound: "character_theory_series_not_found",
} as const;

export const CharacterTheoryStatusSchema = z.enum(["unverified", "confirmed", "disproved"]);

export type CharacterTheoryStatus = z.infer<typeof CharacterTheoryStatusSchema>;

export const CharacterTheorySortSchema = z.enum(["newest", "oldest", "recently_updated", "status"]);

export type CharacterTheorySort = z.infer<typeof CharacterTheorySortSchema>;

const hasNoTarget = (value: {
  bookId?: null | string;
  characterId?: null | string;
  seriesId?: null | string;
}): boolean =>
  (value.characterId ?? null) === null &&
  (value.bookId ?? null) === null &&
  (value.seriesId ?? null) === null;

const requireTarget = (
  value: { bookId?: null | string; characterId?: null | string; seriesId?: null | string },
  ctx: z.RefinementCtx,
): void => {
  if (hasNoTarget(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A theory must target a character, a book or a series",
      path: ["characterId"],
    });
  }
};

export const CreateCharacterTheoryInputSchema = z
  .object({
    bookId: z.uuid().nullish(),
    characterId: z.uuid().nullish(),
    isSpoiler: z.boolean().default(false),
    seriesId: z.uuid().nullish(),
    status: CharacterTheoryStatusSchema.default("unverified"),
    text: z.string().trim().min(1).max(CHARACTER_THEORY_TEXT_MAX),
  })
  .strict()
  .superRefine(requireTarget);

export type CreateCharacterTheoryInput = z.infer<typeof CreateCharacterTheoryInputSchema>;

const requireAtLeastOneField = (
  value: { isSpoiler?: boolean; status?: CharacterTheoryStatus; text?: string },
  ctx: z.RefinementCtx,
): void => {
  if (value.text === undefined && value.status === undefined && value.isSpoiler === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An update must change at least one of text, status or isSpoiler",
      path: ["text"],
    });
  }
};

export const UpdateCharacterTheoryInputSchema = z
  .object({
    isSpoiler: z.boolean().optional(),
    status: CharacterTheoryStatusSchema.optional(),
    text: z.string().trim().min(1).max(CHARACTER_THEORY_TEXT_MAX).optional(),
  })
  .strict()
  .superRefine(requireAtLeastOneField);

export type UpdateCharacterTheoryInput = z.infer<typeof UpdateCharacterTheoryInputSchema>;

export const CharacterTheoriesQuerySchema = z.object({
  bookId: z.uuid().optional(),
  characterId: z.uuid().optional(),
  contextBookId: z.uuid().optional(),
  ...paginationQueryFields({ pageSizeDefault: CHARACTER_THEORIES_DEFAULT_PAGE_SIZE }),
  search: z.string().trim().max(CHARACTER_THEORY_SEARCH_MAX).optional(),
  seriesId: z.uuid().optional(),
  sort: CharacterTheorySortSchema.default("newest"),
  status: CharacterTheoryStatusSchema.optional(),
});

export type CharacterTheoriesQuery = z.infer<typeof CharacterTheoriesQuerySchema>;

export const CharacterTheoryViewSchema = z.object({
  bookId: z.string().nullable(),
  bookTitle: z.string().nullable(),
  characterId: z.string().nullable(),
  characterName: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  isResolved: z.boolean(),
  isSpoiler: z.boolean(),
  seriesId: z.string().nullable(),
  seriesName: z.string().nullable(),
  status: CharacterTheoryStatusSchema,
  text: z.string(),
  updatedAt: z.string(),
});

export type CharacterTheoryView = z.infer<typeof CharacterTheoryViewSchema>;

export const PaginatedCharacterTheoriesSchema = createPaginatedSchema(CharacterTheoryViewSchema);

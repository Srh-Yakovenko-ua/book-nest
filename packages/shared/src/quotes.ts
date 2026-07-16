import { z } from "zod";

import { createPaginatedSchema, LIST_PAGE_SIZE_MAX } from "./common.js";
import { MediaViewSchema } from "./media.js";

const QUOTE_TEXT_MAX = 1000;
const QUOTE_CHAPTER_MAX = 80;
const QUOTE_COMMENT_MAX = 500;
const QUOTE_PAGE_MIN = 1;
export const QUOTE_PAGE_MAX = 10000;
const QUOTE_SEARCH_MAX = 100;
const QUOTES_DEFAULT_PAGE_SIZE = 12;

export const QuoteTextSchema = z
  .string()
  .trim()
  .min(1, "Quote text is required")
  .max(QUOTE_TEXT_MAX, "Quote text must be at most 1000 characters long");

export const QuoteChapterSchema = z
  .string()
  .trim()
  .max(QUOTE_CHAPTER_MAX, "Chapter must be at most 80 characters long");

export const QuoteCommentSchema = z
  .string()
  .trim()
  .max(QUOTE_COMMENT_MAX, "Comment must be at most 500 characters long");

export const QuotePageSchema = z.coerce
  .number()
  .int("Page must be a whole number")
  .min(QUOTE_PAGE_MIN, "Page must be greater than 0")
  .max(QUOTE_PAGE_MAX, "Page must be at most 10000");

export const CreateQuoteInputSchema = z.object({
  chapter: QuoteChapterSchema.nullish(),
  comment: QuoteCommentSchema.nullish(),
  isFavorite: z.boolean().default(false),
  isSpoiler: z.boolean().default(false),
  page: QuotePageSchema.nullish(),
  text: QuoteTextSchema,
});

export type CreateQuoteInput = z.infer<typeof CreateQuoteInputSchema>;

export const UpdateQuoteInputSchema = z.object({
  chapter: QuoteChapterSchema.nullish(),
  comment: QuoteCommentSchema.nullish(),
  isFavorite: z.boolean().optional(),
  isSpoiler: z.boolean().optional(),
  page: QuotePageSchema.nullish(),
  text: QuoteTextSchema.optional(),
});

export type UpdateQuoteInput = z.infer<typeof UpdateQuoteInputSchema>;

export const QuoteFilterSchema = z.enum([
  "all",
  "no_spoiler",
  "with_spoiler",
  "favorites",
  "with_comment",
  "without_comment",
]);

export type QuoteFilter = z.infer<typeof QuoteFilterSchema>;

export const QuoteSortSchema = z.enum([
  "newest",
  "oldest",
  "book_title",
  "book_author",
  "page",
  "favorites_first",
  "no_spoiler_first",
  "with_spoiler_first",
]);

export type QuoteSort = z.infer<typeof QuoteSortSchema>;

export const QuotesQuerySchema = z.object({
  bookId: z.uuid().optional(),
  filter: QuoteFilterSchema.default("all"),
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(QUOTES_DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(QUOTE_SEARCH_MAX).optional(),
  sort: QuoteSortSchema.default("newest"),
});

export type QuotesQuery = z.infer<typeof QuotesQuerySchema>;

export const QuoteBookPreviewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  firstAuthorName: z.string(),
  id: z.string(),
  title: z.string(),
});

export type QuoteBookPreview = z.infer<typeof QuoteBookPreviewSchema>;

export const QuoteViewSchema = z.object({
  book: QuoteBookPreviewSchema,
  bookId: z.string(),
  chapter: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  isFavorite: z.boolean(),
  isSpoiler: z.boolean(),
  page: z.number().int().nullable(),
  text: z.string(),
  updatedAt: z.string(),
});

export type QuoteView = z.infer<typeof QuoteViewSchema>;

export const BookQuotesViewSchema = z.object({
  favoritesCount: z.number().int().nonnegative(),
  items: z.array(QuoteViewSchema),
  spoilerCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export type BookQuotesView = z.infer<typeof BookQuotesViewSchema>;

export const PaginatedQuotesSchema = createPaginatedSchema(QuoteViewSchema);

export const QuotesSummaryBookSchema = z.object({
  id: z.string(),
  quotesCount: z.number().int().nonnegative(),
  title: z.string(),
});

export type QuotesSummaryBook = z.infer<typeof QuotesSummaryBookSchema>;

export const QuotesSummaryAuthorSchema = z.object({
  name: z.string(),
  quotesCount: z.number().int().nonnegative(),
});

export type QuotesSummaryAuthor = z.infer<typeof QuotesSummaryAuthorSchema>;

export const QuotesSummaryViewSchema = z.object({
  favoritesCount: z.number().int().nonnegative(),
  spoilerCount: z.number().int().nonnegative(),
  topAuthor: QuotesSummaryAuthorSchema.nullable(),
  topBook: QuotesSummaryBookSchema.nullable(),
  totalCount: z.number().int().nonnegative(),
  withCommentCount: z.number().int().nonnegative(),
  withoutSpoilerCount: z.number().int().nonnegative(),
});

export type QuotesSummaryView = z.infer<typeof QuotesSummaryViewSchema>;

import { z } from "zod";

import { createPaginatedSchema } from "./common.js";
import { RECENT_USED_LIMIT_DEFAULT, RECENT_USED_LIMIT_MAX } from "./internal.js";
import {
  CatalogLocaleSchema,
  TaxonomyNameSchema,
  TaxonomySearchPaginationQuerySchema,
} from "./taxonomy.js";

export const OPEN_LIBRARY_AUTHOR_KEY_PATTERN = /^OL\d+A$/;

export const OpenLibraryAuthorKeySchema = z
  .string()
  .trim()
  .regex(OPEN_LIBRARY_AUTHOR_KEY_PATTERN, "Enter a valid Open Library author key");

export const BookAuthorReferenceSchema = z.union([
  z.strictObject({ id: z.uuid() }),
  z.strictObject({ openLibraryKey: OpenLibraryAuthorKeySchema }),
  z.strictObject({ name: TaxonomyNameSchema }),
]);

export type BookAuthorReference = z.infer<typeof BookAuthorReferenceSchema>;

export const BOOK_AUTHORS_MAX = 20;

export const BOOK_AUTHORS_REQUIRED_MESSAGE = "Add at least one author";

export const BOOK_AUTHORS_MAX_MESSAGE = `A book can have at most ${BOOK_AUTHORS_MAX} authors`;

export const BookAuthorsInputSchema = z
  .array(BookAuthorReferenceSchema)
  .min(1, BOOK_AUTHORS_REQUIRED_MESSAGE)
  .max(BOOK_AUTHORS_MAX, BOOK_AUTHORS_MAX_MESSAGE);

export const AuthorViewSchema = z.object({
  bio: z.string().nullable(),
  birthYear: z.number().int().nullable(),
  countryCode: z.string().nullable(),
  deathYear: z.number().int().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  openLibraryKey: z.string().nullable(),
  photoAttribution: z.string().nullable(),
  photoLicense: z.string().nullable(),
  photoLicenseUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
});

export type AuthorView = z.infer<typeof AuthorViewSchema>;

export const PaginatedAuthorsSchema = createPaginatedSchema(AuthorViewSchema);

export type BookAuthorsInput = z.infer<typeof BookAuthorsInputSchema>;

export const AuthorLookupResultSchema = z.object({
  birthYear: z.number().int().nullable(),
  inDb: z.boolean(),
  name: z.string(),
  openLibraryKey: z.string(),
  photoUrl: z.string().nullable(),
  source: z.literal("open_library"),
});

export type AuthorLookupResult = z.infer<typeof AuthorLookupResultSchema>;

const AUTHOR_LOOKUP_QUERY_MIN = 2;
const AUTHOR_LOOKUP_QUERY_MAX = 100;

export const AuthorLookupQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(AUTHOR_LOOKUP_QUERY_MIN, "Search query must be at least 2 characters long")
    .max(AUTHOR_LOOKUP_QUERY_MAX, "Search query must be at most 100 characters long"),
});

export const AuthorBookSuggestionViewSchema = z.object({
  coverUrl: z.string().nullable(),
  firstPublishYear: z.number().nullable(),
  openLibraryWorkKey: z.string(),
  title: z.string(),
});

export type AuthorBookSuggestionView = z.infer<typeof AuthorBookSuggestionViewSchema>;

export type AuthorLookupQuery = z.infer<typeof AuthorLookupQuerySchema>;

export const BookAuthorRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const AuthorSearchPaginationQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  locale: CatalogLocaleSchema.default("uk"),
});

export type AuthorSearchPaginationQuery = z.infer<typeof AuthorSearchPaginationQuerySchema>;

export const RecentAuthorsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECENT_USED_LIMIT_MAX)
    .default(RECENT_USED_LIMIT_DEFAULT),
  locale: CatalogLocaleSchema.default("uk"),
});

export type RecentAuthorsQuery = z.infer<typeof RecentAuthorsQuerySchema>;

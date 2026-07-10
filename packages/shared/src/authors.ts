import { z } from "zod";

import type { Nullable } from "./common.js";

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

export type AuthorView = {
  bio: Nullable<string>;
  birthYear: Nullable<number>;
  countryCode: Nullable<string>;
  deathYear: Nullable<number>;
  id: string;
  isCustom: boolean;
  name: string;
  openLibraryKey: Nullable<string>;
  photoAttribution: Nullable<string>;
  photoLicense: Nullable<string>;
  photoLicenseUrl: Nullable<string>;
  photoUrl: Nullable<string>;
};

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

export type AuthorBookSuggestionView = {
  coverUrl: Nullable<string>;
  firstPublishYear: Nullable<number>;
  openLibraryWorkKey: string;
  title: string;
};

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

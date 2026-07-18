import { z } from "zod";

import { RECENT_USED_LIMIT_DEFAULT, RECENT_USED_LIMIT_MAX } from "./internal.js";
import { TaxonomyNameSchema } from "./taxonomy.js";

const BOOK_GENRES_MAX = 5;
const GENRE_KEY_MAX = 64;

export const GenreKeySchema = z.string().trim().min(1).max(GENRE_KEY_MAX);

export const BookGenresSchema = z
  .array(GenreKeySchema)
  .max(BOOK_GENRES_MAX, "You can select at most 5 genres")
  .refine((genres) => new Set(genres).size === genres.length, "Genres must not contain duplicates");

export const CreateGenreSchema = z.object({ name: TaxonomyNameSchema });

export type CreateGenreInput = z.infer<typeof CreateGenreSchema>;

export type GenreView = {
  groupKey: string;
  groupName: string;
  id: string;
  isDefault: boolean;
  key: string;
  name: string;
};

export const RecentGenresQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECENT_USED_LIMIT_MAX)
    .default(RECENT_USED_LIMIT_DEFAULT),
});

export type RecentGenresQuery = z.infer<typeof RecentGenresQuerySchema>;

export const GenreStatsViewSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: z.number().int(),
  coverUrls: z.array(z.string()),
  key: z.string(),
  label: z.string(),
  readCount: z.number().int(),
  readingQueueCount: z.number().int(),
  wantToBuyCount: z.number().int(),
});

export type GenreStatsView = z.infer<typeof GenreStatsViewSchema>;

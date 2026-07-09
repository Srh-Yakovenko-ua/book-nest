import { z } from "zod";

const CHANGELOG_LIMIT_MAX = 50;

export const ChangelogCategorySchema = z.enum(["feature", "improvement", "fix"]);

export type ChangelogCategory = z.infer<typeof ChangelogCategorySchema>;

export const ChangelogLocaleSchema = z.enum(["uk", "en"]);

export type ChangelogLocale = z.infer<typeof ChangelogLocaleSchema>;

export const ChangelogEntryViewSchema = z.object({
  body: z.string(),
  category: ChangelogCategorySchema,
  id: z.string(),
  publishedAt: z.string(),
  slug: z.string(),
  title: z.string(),
  version: z.string().nullable(),
});

export type ChangelogEntryView = z.infer<typeof ChangelogEntryViewSchema>;

export const ChangelogListResponseSchema = z.object({
  entries: z.array(ChangelogEntryViewSchema),
  nextCursor: z.uuid().nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export type ChangelogListResponse = z.infer<typeof ChangelogListResponseSchema>;

export const ChangelogListQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(CHANGELOG_LIMIT_MAX).optional(),
  locale: ChangelogLocaleSchema.default("uk"),
});

export type ChangelogListQuery = z.infer<typeof ChangelogListQuerySchema>;

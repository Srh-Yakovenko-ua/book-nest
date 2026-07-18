import type { AuthorView } from "@app/shared";

import { z } from "zod";

export const authorViewSchema = z.object({
  bio: z.string().nullable(),
  birthYear: z.number().nullable(),
  countryCode: z.string().nullable(),
  deathYear: z.number().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  openLibraryKey: z.string().nullable(),
  photoAttribution: z.string().nullable(),
  photoLicense: z.string().nullable(),
  photoLicenseUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
}) satisfies z.ZodType<AuthorView>;

export const authorSearchResultSchema = z.object({
  items: z.array(authorViewSchema),
  page: z.number(),
  pagesCount: z.number(),
  pageSize: z.number(),
  totalCount: z.number(),
});

import { z } from "zod";

import { collapseSpaces, LIST_PAGE_SIZE_MAX, PAGE_NUMBER_MAX } from "./common.js";
import { NoHtmlString } from "./internal.js";

const TAXONOMY_NAME_MIN = 2;
const TAXONOMY_NAME_MAX = 100;

export const TaxonomyNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(TAXONOMY_NAME_MIN, "Name must be at least 2 characters long").max(
      TAXONOMY_NAME_MAX,
      "Name must be at most 100 characters long",
    ),
  );

export const TaxonomySearchPaginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).max(PAGE_NUMBER_MAX).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(10),
  search: z.string().trim().max(TAXONOMY_NAME_MAX).optional(),
});

export type TaxonomySearchPaginationQuery = z.infer<typeof TaxonomySearchPaginationQuerySchema>;

export const CatalogLocaleSchema = z.enum(["en", "uk"]);

export type CatalogLocale = z.infer<typeof CatalogLocaleSchema>;

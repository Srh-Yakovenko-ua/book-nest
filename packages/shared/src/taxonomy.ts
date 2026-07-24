import { z } from "zod";

import { collapseSpaces, paginationQueryFields } from "./common.js";
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
  ...paginationQueryFields({ pageSizeDefault: 10 }),
  search: z.string().trim().max(TAXONOMY_NAME_MAX).optional(),
});

export type TaxonomySearchPaginationQuery = z.infer<typeof TaxonomySearchPaginationQuerySchema>;

export const CatalogLocaleSchema = z.enum(["en", "uk"]);

export type CatalogLocale = z.infer<typeof CatalogLocaleSchema>;

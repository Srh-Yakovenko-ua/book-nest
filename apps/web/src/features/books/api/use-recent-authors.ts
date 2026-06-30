import type { AuthorView } from "@app/shared";

import { CatalogLocaleSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import { authorsControllerRecent } from "@/shared/api/generated/endpoints/authors/authors";

import { authorViewSchema } from "./use-author-search";

const RECENT_AUTHORS_LIMIT = 8;
const recentAuthorsSchema = z.array(authorViewSchema);

export function useRecentAuthors() {
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    queryFn: async (): Promise<AuthorView[]> => {
      const response = await authorsControllerRecent({ limit: RECENT_AUTHORS_LIMIT, locale });
      return recentAuthorsSchema.parse(response);
    },
    queryKey: ["authors", "recent", locale],
  });
}

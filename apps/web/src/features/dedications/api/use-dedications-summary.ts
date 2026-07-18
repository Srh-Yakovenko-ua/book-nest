import type { DedicationsSummaryView } from "@app/shared";

import { DedicationsSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { booksControllerDedicationsSummary } from "@/shared/api/generated/endpoints/books/books";

import { dedicationKeys } from "./dedication-keys";

export function useDedicationsSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<DedicationsSummaryView> =>
      DedicationsSummaryViewSchema.parse(await booksControllerDedicationsSummary({ signal })),
    queryKey: dedicationKeys.summary,
  });
}

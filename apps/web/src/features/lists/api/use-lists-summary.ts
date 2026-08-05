import type { ListsSummaryView } from "@app/shared";

import { ListsSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { listsControllerSummary } from "@/shared/api/generated/endpoints/lists/lists";

import { listKeys } from "./list-keys";

export function useListsSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<ListsSummaryView> =>
      ListsSummaryViewSchema.parse(await listsControllerSummary({ signal })),
    queryKey: listKeys.summary,
  });
}

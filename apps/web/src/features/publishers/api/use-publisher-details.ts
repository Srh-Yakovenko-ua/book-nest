import type { LibraryPublisherDetail } from "@app/shared";

import { CatalogLocaleSchema, LibraryPublisherDetailSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { publishersControllerLibraryDetail } from "@/shared/api/generated/endpoints/publishers/publishers";

import { publisherKeys } from "./publisher-keys";

export function usePublisherDetails(id: string) {
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());

  return useQuery({
    queryFn: async (): Promise<LibraryPublisherDetail> => {
      const response = await publishersControllerLibraryDetail(id, { locale });
      return LibraryPublisherDetailSchema.parse(response);
    },
    queryKey: publisherKeys.detail(id),
    retry: false,
  });
}

import type { PublisherDuplicateCandidate } from "@app/shared";

import { CatalogLocaleSchema, PublisherDuplicateCandidateSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import type { PublishersControllerDuplicateCandidatesParams } from "@/shared/api/generated/model";

import { publishersControllerDuplicateCandidates } from "@/shared/api/generated/endpoints/publishers/publishers";

export const PUBLISHER_LOOKUP = {
  debounceMs: 250,
  minNameLength: 2,
} as const;

type UsePublisherDuplicateCandidatesArgs = {
  excludePublisherId?: string;
  name: string;
};

export function usePublisherDuplicateCandidates({
  excludePublisherId,
  name,
}: UsePublisherDuplicateCandidatesArgs) {
  const trimmed = name.trim();
  const locale = CatalogLocaleSchema.catch("uk").parse(useLocale());
  const params: PublishersControllerDuplicateCandidatesParams = {
    locale,
    name: trimmed,
    ...(excludePublisherId === undefined ? {} : { excludePublisherId }),
  };

  return useQuery({
    enabled: trimmed.length >= PUBLISHER_LOOKUP.minNameLength,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PublisherDuplicateCandidate[]> =>
      z
        .array(PublisherDuplicateCandidateSchema)
        .parse(await publishersControllerDuplicateCandidates(params)),
    queryKey: ["publishers", "duplicates", params],
  });
}

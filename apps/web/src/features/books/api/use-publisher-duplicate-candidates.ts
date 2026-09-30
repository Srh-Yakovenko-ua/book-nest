import type { Nullable, PublisherDuplicateCandidate } from "@app/shared";

import { CatalogLocaleSchema, PublisherDuplicateCandidateSchema } from "@app/shared";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { z } from "zod";

import type { PublishersControllerDuplicateCandidatesParams } from "@/shared/api/generated/model";

import { publishersControllerDuplicateCandidates } from "@/shared/api/generated/endpoints/publishers/publishers";

export const PUBLISHER_LOOKUP = {
  debounceMs: 250,
  minNameLength: 2,
} as const;

type PublisherDuplicateCandidatesArgs = {
  excludePublisherId?: string;
  locale: string;
  name: string;
};

export function distinctMatchedName(candidate: PublisherDuplicateCandidate): Nullable<string> {
  const matchedName = candidate.matchedName?.trim() ?? "";
  if (matchedName === "") return null;
  if (matchedName.toLowerCase() === candidate.name.trim().toLowerCase()) return null;
  return matchedName;
}

export function publisherDuplicateCandidatesQueryOptions({
  excludePublisherId,
  locale,
  name,
}: PublisherDuplicateCandidatesArgs) {
  const trimmedName = name.trim();
  const params: PublishersControllerDuplicateCandidatesParams = {
    locale: CatalogLocaleSchema.catch("uk").parse(locale),
    name: trimmedName,
    ...(excludePublisherId === undefined ? {} : { excludePublisherId }),
  };

  return queryOptions({
    enabled: trimmedName.length >= PUBLISHER_LOOKUP.minNameLength,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PublisherDuplicateCandidate[]> =>
      z
        .array(PublisherDuplicateCandidateSchema)
        .parse(await publishersControllerDuplicateCandidates(params)),
    queryKey: ["publishers", "duplicates", params],
  });
}

export function usePublisherDuplicateCandidates(
  args: Omit<PublisherDuplicateCandidatesArgs, "locale">,
) {
  const locale = useLocale();

  return useQuery(publisherDuplicateCandidatesQueryOptions({ ...args, locale }));
}

import type { QueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { characterKeys } from "@/features/characters/api/character-keys";
import { seriesKeys } from "@/features/series/api/series-keys";

import type { TagsCatalogParams, TagsFacetsParams } from "../model/tags-query";

type TagFamily = "catalog" | "deletion-preview" | "facets" | "picker" | "summary";

const TAGS_ROOT = "/api/tags";

const TAG_AGGREGATE_FAMILIES = [
  "catalog",
  "facets",
  "summary",
] as const satisfies readonly TagFamily[];

function family<TFamily extends TagFamily>(name: TFamily) {
  return [TAGS_ROOT, name] as const;
}

export const tagsKeys = {
  catalog: (params: TagsCatalogParams) => [...family("catalog"), params] as const,
  deletionPreview: (id: string) => [...family("deletion-preview"), id] as const,
  facets: (params: TagsFacetsParams) => [...family("facets"), params] as const,
  picker: (term: string) => [...family("picker"), term] as const,
  pickers: family("picker"),
  summary: family("summary"),
};

export async function invalidateTagAggregateQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    TAG_AGGREGATE_FAMILIES.map((name) => queryClient.invalidateQueries({ queryKey: family(name) })),
  );
}

export async function invalidateTagCollectionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateTagAggregateQueries(queryClient),
    invalidateTagPickerQueries(queryClient),
  ]);
}

export async function invalidateTagMetadataQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateTagCollectionQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: bookKeys.root }),
    queryClient.invalidateQueries({ queryKey: characterKeys.all }),
    queryClient.invalidateQueries({ queryKey: seriesKeys.root }),
  ]);
}

export async function invalidateTagPickerQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: tagsKeys.pickers });
}

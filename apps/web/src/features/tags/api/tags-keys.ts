import type { QueryKey } from "@tanstack/react-query";

import { partialMatchKey } from "@tanstack/react-query";

import type { TagsCatalogParams, TagsFacetsParams } from "../model/tags-query";

type TagFamily = "catalog" | "deletion-preview" | "facets" | "picker" | "selected" | "summary";

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
  selected: (ids: readonly string[]) => [...family("selected"), ids] as const,
  selections: family("selected"),
  summary: family("summary"),
};

export function matchesTagAggregateKey({ queryKey }: { queryKey: QueryKey }): boolean {
  return TAG_AGGREGATE_FAMILIES.some((name) => partialMatchKey(queryKey, family(name)));
}

export function matchesTagPickerKey({ queryKey }: { queryKey: QueryKey }): boolean {
  return [tagsKeys.pickers, tagsKeys.selections].some((prefix) =>
    partialMatchKey(queryKey, prefix),
  );
}

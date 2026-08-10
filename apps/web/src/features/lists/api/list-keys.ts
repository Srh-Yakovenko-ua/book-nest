import type { ListsListParams } from "../model/lists-query";

const LISTS_ROOT = "/api/lists";
const LISTS_INDEX = [LISTS_ROOT, "list"] as const;

export const listKeys = {
  detail: (id: string) => [LISTS_ROOT, "detail", id] as const,
  facets: (id: string) => [LISTS_ROOT, "facets", id] as const,
  index: LISTS_INDEX,
  list: (params: ListsListParams) => [...LISTS_INDEX, params] as const,
  overview: (id: string) => [LISTS_ROOT, "overview", id] as const,
  related: (id: string) => [LISTS_ROOT, "related", id] as const,
  root: [LISTS_ROOT] as const,
  summary: [LISTS_ROOT, "summary"] as const,
};

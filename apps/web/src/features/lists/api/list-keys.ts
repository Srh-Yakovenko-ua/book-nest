export type ListsListParams = { pageSize: number };

const LISTS_ROOT = "/api/lists";

export const listKeys = {
  detail: (id: string) => [LISTS_ROOT, "detail", id] as const,
  list: (params: ListsListParams) => [LISTS_ROOT, "list", params] as const,
  root: [LISTS_ROOT] as const,
  summary: [LISTS_ROOT, "summary"] as const,
};

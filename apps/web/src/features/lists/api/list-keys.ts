const LISTS_ROOT = "/api/lists";

export const listKeys = {
  detail: (id: string) => [LISTS_ROOT, "detail", id] as const,
};

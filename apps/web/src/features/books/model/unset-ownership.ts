import type { OwnershipStatus } from "@app/shared";

import type { LibraryListParams } from "./library-query";

type UnsetOwnershipConfig = {
  bulkStatuses: readonly OwnershipStatus[];
  defaultStatus: OwnershipStatus;
  pageSize: number;
  searchDebounceMs: number;
};

export const UNSET_OWNERSHIP = {
  bulkStatuses: ["owned", "want_to_buy", "in_transit"],
  defaultStatus: "owned",
  pageSize: 24,
  searchDebounceMs: 250,
} as const satisfies UnsetOwnershipConfig;

export function unsetOwnershipParams(search: string): LibraryListParams {
  const query = search.trim();
  return {
    ageCategory: [],
    author: [],
    format: [],
    genre: [],
    language: [],
    owner: ["none"],
    pageSize: UNSET_OWNERSHIP.pageSize,
    publisher: [],
    status: [],
    tag: [],
    ...(query === "" ? {} : { q: query }),
  };
}

import type { DedicationFilter, DedicationSort } from "@app/shared";

import {
  DedicationFilterSchema,
  DEDICATIONS_PAGE_SIZE_DEFAULT,
  DedicationSortSchema,
} from "@app/shared";
import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { BooksControllerDedicationsParams } from "@/shared/api/generated/model";

export type DedicationsListParams = Omit<BooksControllerDedicationsParams, "pageNumber">;

export const DEDICATION_FILTER_DEFAULT: DedicationFilter = "all";
export const DEDICATION_SORT_DEFAULT: DedicationSort = "newest";

export const DEDICATION_SORT_OPTIONS = DedicationSortSchema.options;

export const DEDICATION_VIEW_MODES = ["grid", "list"] as const;
export type DedicationView = (typeof DEDICATION_VIEW_MODES)[number];
export const DEDICATION_VIEW_DEFAULT: DedicationView = "grid";

export const DEDICATION_CHIP_FILTERS = [
  "all",
  "favorites",
  "finished",
  "unfinished",
] as const satisfies readonly DedicationFilter[];

export const dedicationsQueryParsers = {
  filter: parseAsStringLiteral(DedicationFilterSchema.options).withDefault(
    DEDICATION_FILTER_DEFAULT,
  ),
  genre: parseAsString.withDefault(""),
  search: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(DedicationSortSchema.options).withDefault(DEDICATION_SORT_DEFAULT),
  view: parseAsStringLiteral(DEDICATION_VIEW_MODES).withDefault(DEDICATION_VIEW_DEFAULT),
};

export type DedicationsQueryState = inferParserType<typeof dedicationsQueryParsers>;

export const DEDICATIONS_FILTERS_RESET = {
  filter: null,
  genre: null,
  search: null,
  sort: null,
} satisfies Partial<Record<keyof DedicationsQueryState, null>>;

export function hasActiveDedicationFilters(state: DedicationsQueryState): boolean {
  return (
    state.filter !== DEDICATION_FILTER_DEFAULT ||
    state.genre !== "" ||
    state.search.trim() !== "" ||
    state.sort !== DEDICATION_SORT_DEFAULT
  );
}

export function toDedicationsParams(state: DedicationsQueryState): DedicationsListParams {
  const search = state.search.trim();

  return {
    filter: state.filter,
    pageSize: DEDICATIONS_PAGE_SIZE_DEFAULT,
    sort: state.sort,
    ...(search === "" ? {} : { q: search }),
    ...(state.genre === "" ? {} : { genre: state.genre }),
  };
}

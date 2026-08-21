"use client";

import type { WishlistSort } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BooksControllerWishlistParams } from "@/shared/api/generated/model";

import type { WishlistViewMode } from "./books-to-buy-derive";
import type { WishlistQueryState } from "./wishlist-query";

import {
  countActiveWishlistFilters,
  hasActiveWishlistSearch,
  toWishlistParams,
  WISHLIST_FILTERS_RESET,
  wishlistQueryParsers,
} from "./wishlist-query";

export type UseWishlistQueryResult = {
  activeFilterCount: number;
  clearAll: () => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: BooksControllerWishlistParams;
  setSearch: (value: string) => void;
  setSort: (value: WishlistSort) => void;
  setState: ReturnType<typeof useQueryStates<typeof wishlistQueryParsers>>[1];
  setView: (value: WishlistViewMode) => void;
  sort: WishlistSort;
  state: WishlistQueryState;
  view: WishlistViewMode;
};

export function useWishlistQuery(): UseWishlistQueryResult {
  const [state, setState] = useQueryStates(wishlistQueryParsers);
  const activeFilterCount = countActiveWishlistFilters(state);

  return {
    activeFilterCount,
    clearAll: () => void setState({ q: null, ...WISHLIST_FILTERS_RESET }),
    clearFilters: () => void setState(WISHLIST_FILTERS_RESET),
    hasActiveFilters: activeFilterCount > 0,
    hasActiveSearch: hasActiveWishlistSearch(state),
    listParams: toWishlistParams(state),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setState,
    setView: (value) => void setState({ view: value }),
    sort: state.sort,
    state,
    view: state.view,
  };
}

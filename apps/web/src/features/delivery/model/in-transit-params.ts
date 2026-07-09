import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs";

import type { DeliveryControllerInTransitListParams } from "@/shared/api/generated/model";

import {
  DeliveryControllerInTransitListFilter,
  DeliveryControllerInTransitListSort,
} from "@/shared/api/generated/model";

export const DELIVERY_PAGE_SIZE = 24;
export const DELIVERY_FILTER_DEFAULT = DeliveryControllerInTransitListFilter.all;
export const DELIVERY_SORT_DEFAULT = DeliveryControllerInTransitListSort.closest_delivery;

export const DELIVERY_PRIMARY_FILTERS = [
  DeliveryControllerInTransitListFilter.all,
  DeliveryControllerInTransitListFilter.ordered,
  DeliveryControllerInTransitListFilter.in_transit,
  DeliveryControllerInTransitListFilter.arriving_soon,
  DeliveryControllerInTransitListFilter.this_week,
  DeliveryControllerInTransitListFilter.delayed,
  DeliveryControllerInTransitListFilter.no_delivery_date,
] as const satisfies readonly DeliveryControllerInTransitListFilter[];

export const DELIVERY_SORT_ORDER = Object.values(DeliveryControllerInTransitListSort);

const filterValues = Object.values(DeliveryControllerInTransitListFilter);
const sortValues = Object.values(DeliveryControllerInTransitListSort);

export const deliveryQueryParsers = {
  filter: parseAsStringLiteral(filterValues).withDefault(DELIVERY_FILTER_DEFAULT),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(sortValues).withDefault(DELIVERY_SORT_DEFAULT),
};

export type DeliveryListParams = Omit<DeliveryControllerInTransitListParams, "pageNumber">;

export type DeliveryQueryState = inferParserType<typeof deliveryQueryParsers>;

export function hasActiveDeliveryFilters(state: DeliveryQueryState): boolean {
  return state.filter !== DELIVERY_FILTER_DEFAULT;
}

export function hasActiveDeliverySearch(state: DeliveryQueryState): boolean {
  return state.q.trim() !== "";
}

export function toDeliveryListParams(state: DeliveryQueryState): DeliveryListParams {
  const search = state.q.trim();

  return {
    filter: state.filter,
    pageSize: DELIVERY_PAGE_SIZE,
    sort: state.sort,
    ...(search === "" ? {} : { search }),
  };
}

import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { DeliveryReadControllerInTransitListParams } from "@/shared/api/generated/model";

import {
  DeliveryReadControllerInTransitListFilter,
  DeliveryReadControllerInTransitListSort,
} from "@/shared/api/generated/model";

export const DELIVERY_PAGE_SIZE = 24;
export const DELIVERY_FILTER_DEFAULT = DeliveryReadControllerInTransitListFilter.all;
export const DELIVERY_SORT_DEFAULT = DeliveryReadControllerInTransitListSort.closest_delivery;

export const DELIVERY_PRIMARY_FILTERS = [
  DeliveryReadControllerInTransitListFilter.all,
  DeliveryReadControllerInTransitListFilter.ordered,
  DeliveryReadControllerInTransitListFilter.in_transit,
  DeliveryReadControllerInTransitListFilter.arriving_soon,
  DeliveryReadControllerInTransitListFilter.this_week,
  DeliveryReadControllerInTransitListFilter.delayed,
  DeliveryReadControllerInTransitListFilter.no_delivery_date,
] as const satisfies readonly DeliveryReadControllerInTransitListFilter[];

export const DELIVERY_SORT_ORDER = Object.values(DeliveryReadControllerInTransitListSort);

const filterValues = Object.values(DeliveryReadControllerInTransitListFilter);
const sortValues = Object.values(DeliveryReadControllerInTransitListSort);

export const deliveryQueryParsers = {
  filter: parseAsStringLiteral(filterValues).withDefault(DELIVERY_FILTER_DEFAULT),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(sortValues).withDefault(DELIVERY_SORT_DEFAULT),
};

export type DeliveryListParams = Omit<DeliveryReadControllerInTransitListParams, "pageNumber">;

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

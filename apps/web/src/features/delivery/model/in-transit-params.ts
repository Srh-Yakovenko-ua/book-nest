import type { InTransitAttentionReason, InTransitSummaryView, Nullable } from "@app/shared";

import { IN_TRANSIT_ATTENTION_FILTER, InTransitAttentionReasonSchema } from "@app/shared";
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
  DeliveryReadControllerInTransitListFilter.ready_for_pickup,
  DeliveryReadControllerInTransitListFilter.delayed,
] as const satisfies readonly DeliveryReadControllerInTransitListFilter[];

export type DeliveryFilterCounts = Record<DeliveryPrimaryFilter, number>;

export type DeliveryPrimaryFilter = (typeof DELIVERY_PRIMARY_FILTERS)[number];

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

export function isDeliveryPrimaryFilter(
  filter: DeliveryReadControllerInTransitListFilter,
): filter is DeliveryPrimaryFilter {
  return DELIVERY_PRIMARY_FILTERS.some((value) => value === filter);
}

export function toDeliveryAttentionReason(
  filter: DeliveryReadControllerInTransitListFilter,
): Nullable<InTransitAttentionReason> {
  return (
    InTransitAttentionReasonSchema.options.find(
      (reason) => IN_TRANSIT_ATTENTION_FILTER[reason] === filter,
    ) ?? null
  );
}

export function toDeliveryFilterCounts(summary: InTransitSummaryView): DeliveryFilterCounts {
  return {
    all: summary.activeBooksCount,
    delayed: summary.delayedCount,
    in_transit: summary.inTransitCount,
    ordered: summary.orderedCount,
    ready_for_pickup: summary.readyForPickupCount,
  };
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

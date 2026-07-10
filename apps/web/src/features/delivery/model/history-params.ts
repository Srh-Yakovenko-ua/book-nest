import {
  type inferParserType,
  parseAsBoolean,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

import type { DeliveryControllerHistoryListParams } from "@/shared/api/generated/model";

import {
  DeliveryControllerHistoryListCurrency,
  DeliveryControllerHistoryListSort,
  DeliveryControllerHistoryListTab,
} from "@/shared/api/generated/model";

export const DELIVERY_HISTORY_PAGE_SIZE = 24;
export const DELIVERY_HISTORY_TAB_DEFAULT = DeliveryControllerHistoryListTab.all;
export const DELIVERY_HISTORY_SORT_DEFAULT = DeliveryControllerHistoryListSort.newest_orders;

export const DELIVERY_HISTORY_TABS = [
  DeliveryControllerHistoryListTab.all,
  DeliveryControllerHistoryListTab.active,
  DeliveryControllerHistoryListTab.received,
  DeliveryControllerHistoryListTab.cancelled,
] as const satisfies readonly DeliveryControllerHistoryListTab[];

export const DELIVERY_HISTORY_SORT_ORDER = Object.values(DeliveryControllerHistoryListSort);
export const DELIVERY_CURRENCY_OPTIONS = Object.values(DeliveryControllerHistoryListCurrency);

const tabValues = Object.values(DeliveryControllerHistoryListTab);
const sortValues = Object.values(DeliveryControllerHistoryListSort);
const currencyValues = Object.values(DeliveryControllerHistoryListCurrency);

export const deliveryHistoryParsers = {
  currency: parseAsStringLiteral(currencyValues),
  from: parseAsString.withDefault(""),
  hasTrackingNumber: parseAsBoolean,
  hasTrackingUrl: parseAsBoolean,
  priceMax: parseAsFloat,
  priceMin: parseAsFloat,
  q: parseAsString.withDefault(""),
  service: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(sortValues).withDefault(DELIVERY_HISTORY_SORT_DEFAULT),
  store: parseAsString.withDefault(""),
  tab: parseAsStringLiteral(tabValues).withDefault(DELIVERY_HISTORY_TAB_DEFAULT),
  to: parseAsString.withDefault(""),
};

export type DeliveryHistoryListParams = Omit<DeliveryControllerHistoryListParams, "pageNumber">;

export type DeliveryHistoryQueryState = inferParserType<typeof deliveryHistoryParsers>;

export function hasActiveHistoryFilters(state: DeliveryHistoryQueryState): boolean {
  return state.tab !== DELIVERY_HISTORY_TAB_DEFAULT || historyFilterCount(state) > 0;
}

export function hasActiveHistorySearch(state: DeliveryHistoryQueryState): boolean {
  return state.q.trim() !== "";
}

export function historyFilterCount(state: DeliveryHistoryQueryState): number {
  const flags = [
    state.currency !== null,
    state.store.trim() !== "",
    state.service.trim() !== "",
    state.from !== "",
    state.to !== "",
    state.priceMin !== null,
    state.priceMax !== null,
    state.hasTrackingNumber !== null,
    state.hasTrackingUrl !== null,
  ];
  return flags.filter(Boolean).length;
}

export function toDeliveryHistoryListParams(
  state: DeliveryHistoryQueryState,
): DeliveryHistoryListParams {
  const search = state.q.trim();
  const store = state.store.trim();
  const service = state.service.trim();

  return {
    pageSize: DELIVERY_HISTORY_PAGE_SIZE,
    sort: state.sort,
    tab: state.tab,
    ...(search === "" ? {} : { search }),
    ...(store === "" ? {} : { store }),
    ...(service === "" ? {} : { service }),
    ...(state.currency === null ? {} : { currency: state.currency }),
    ...(state.from === "" ? {} : { from: state.from }),
    ...(state.to === "" ? {} : { to: state.to }),
    ...(state.priceMin === null ? {} : { priceMin: state.priceMin }),
    ...(state.priceMax === null ? {} : { priceMax: state.priceMax }),
    ...(state.hasTrackingNumber === null
      ? {}
      : { hasTrackingNumber: state.hasTrackingNumber ? "true" : "false" }),
    ...(state.hasTrackingUrl === null
      ? {}
      : { hasTrackingUrl: state.hasTrackingUrl ? "true" : "false" }),
  };
}

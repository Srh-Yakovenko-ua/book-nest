import {
  type inferParserType,
  parseAsBoolean,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { DeliveryReadControllerHistoryListParams } from "@/shared/api/generated/model";

import {
  DeliveryReadControllerHistoryListCurrency,
  DeliveryReadControllerHistoryListSort,
  DeliveryReadControllerHistoryListTab,
} from "@/shared/api/generated/model";

export const DELIVERY_HISTORY_PAGE_SIZE = 24;
export const DELIVERY_HISTORY_PANEL_ID = "delivery-history-results";
export const DELIVERY_HISTORY_TAB_DEFAULT = DeliveryReadControllerHistoryListTab.all;
export const DELIVERY_HISTORY_SORT_DEFAULT = DeliveryReadControllerHistoryListSort.newest_orders;

export const DELIVERY_HISTORY_TABS = [
  DeliveryReadControllerHistoryListTab.all,
  DeliveryReadControllerHistoryListTab.active,
  DeliveryReadControllerHistoryListTab.received,
  DeliveryReadControllerHistoryListTab.cancelled,
] as const satisfies readonly DeliveryReadControllerHistoryListTab[];

export const DELIVERY_HISTORY_SORT_ORDER = Object.values(DeliveryReadControllerHistoryListSort);
export const DELIVERY_CURRENCY_OPTIONS = Object.values(DeliveryReadControllerHistoryListCurrency);

const tabValues = Object.values(DeliveryReadControllerHistoryListTab);
const sortValues = Object.values(DeliveryReadControllerHistoryListSort);
const currencyValues = Object.values(DeliveryReadControllerHistoryListCurrency);

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

export type DeliveryHistoryListParams = Omit<DeliveryReadControllerHistoryListParams, "pageNumber">;

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

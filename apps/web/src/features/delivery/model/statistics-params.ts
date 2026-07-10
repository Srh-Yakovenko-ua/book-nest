import { type inferParserType, parseAsBoolean, parseAsString, parseAsStringLiteral } from "nuqs";

import type { DeliveryControllerStatisticsParams } from "@/shared/api/generated/model";

import {
  DeliveryControllerStatisticsCurrency,
  DeliveryControllerStatisticsStatus,
} from "@/shared/api/generated/model";

export const DELIVERY_STATISTICS_CURRENCIES = Object.values(DeliveryControllerStatisticsCurrency);
export const DELIVERY_STATISTICS_STATUSES = Object.values(DeliveryControllerStatisticsStatus);

const currencyValues = Object.values(DeliveryControllerStatisticsCurrency);
const statusValues = Object.values(DeliveryControllerStatisticsStatus);

export const deliveryStatisticsParsers = {
  currency: parseAsStringLiteral(currencyValues),
  from: parseAsString.withDefault(""),
  includeCancelled: parseAsBoolean.withDefault(false),
  status: parseAsStringLiteral(statusValues),
  store: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
};

export type DeliveryStatisticsQueryState = inferParserType<typeof deliveryStatisticsParsers>;

export function hasActiveStatisticsFilters(state: DeliveryStatisticsQueryState): boolean {
  return statisticsFilterCount(state) > 0;
}

export function statisticsFilterCount(state: DeliveryStatisticsQueryState): number {
  const flags = [
    state.currency !== null,
    state.status !== null,
    state.store.trim() !== "",
    state.from !== "",
    state.to !== "",
  ];
  return flags.filter(Boolean).length;
}

export function toDeliveryStatisticsParams(
  state: DeliveryStatisticsQueryState,
): DeliveryControllerStatisticsParams {
  const store = state.store.trim();

  return {
    includeCancelled: state.includeCancelled ? "true" : "false",
    ...(state.currency === null ? {} : { currency: state.currency }),
    ...(state.status === null ? {} : { status: state.status }),
    ...(store === "" ? {} : { store }),
    ...(state.from === "" ? {} : { from: state.from }),
    ...(state.to === "" ? {} : { to: state.to }),
  };
}

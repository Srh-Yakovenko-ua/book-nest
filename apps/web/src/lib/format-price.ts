import type { Currency, Nullable } from "@app/shared";

import { DEFAULT_CURRENCY } from "@app/shared";

import { formatNumber } from "@/lib/format";

export const CURRENCY_LABELS = {
  EUR: "€",
  UAH: "грн",
  USD: "$",
} as const satisfies Record<Currency, string>;

export function formatStorePrice({
  currency,
  locale,
  price,
}: {
  currency: Nullable<Currency>;
  locale: string;
  price: number;
}): string {
  return `${formatNumber(price, locale)} ${CURRENCY_LABELS[currency ?? DEFAULT_CURRENCY]}`;
}

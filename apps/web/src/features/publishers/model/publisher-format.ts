import type { Nullable } from "@app/shared";

import { formatNumber } from "@/lib/format";

export function formatCoveragePercent(percent: number, locale: string): string {
  if (percent > 0 && percent < 1) return "<1";
  return formatNumber(Math.round(percent), locale);
}

export function publisherCountryLabel(
  countryCode: Nullable<string>,
  locale: string,
  fallback: string,
): string {
  if (countryCode === null || countryCode.trim() === "") return fallback;

  try {
    const regionNames = new Intl.DisplayNames([locale], { type: "region" });
    return regionNames.of(countryCode.trim().toUpperCase()) ?? fallback;
  } catch {
    return fallback;
  }
}

export function publisherPriceLabel(amount: number, currency: string, locale: string): string {
  try {
    return formatNumber(amount, locale, { currency, style: "currency" });
  } catch {
    return `${formatNumber(amount, locale)} ${currency}`;
  }
}

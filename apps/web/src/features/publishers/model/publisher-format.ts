import type { Nullable } from "@app/shared";

import { format } from "date-fns";

import { dateFnsLocale, formatNumber, parseIsoDay } from "@/lib/format";

export function formatCoveragePercent(percent: number, locale: string): string {
  if (percent > 0 && percent < 1) return "<1";
  return formatNumber(Math.round(percent), locale);
}

export function publisherAddedDateLabel(iso: string, locale: string): string {
  return format(parseIsoDay(iso), "d MMM yyyy", { locale: dateFnsLocale(locale) });
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

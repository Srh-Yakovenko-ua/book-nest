import type {
  BookOrderStatisticsPulseSignal,
  BookOrderStatisticsPulseTone,
  Currency,
  Nullable,
} from "@app/shared";

export type PulseFormatters = {
  comparison: string;
  money: (amount: number, currency: Currency) => string;
  month: (monthKey: string) => string;
  percent: (value: number) => string;
};

export type PulseItem = {
  id: string;
  messageKey: PulseMessageKey;
  tone: BookOrderStatisticsPulseTone;
  values: Record<string, string>;
};

export type PulseMessageKey =
  | "delivery_share.default"
  | "discount_savings.plain"
  | "discount_savings.withPercent"
  | "record_month.allTime"
  | "record_month.period"
  | `${"avg_book_price_change" | "avg_landed_cost_change" | "spend_change"}.${"down" | "flat" | "up"}`
  | `store_growth.${"down" | "up"}`;

export const PULSE = {
  maxItems: 4,
} as const;

export function pulseItems(
  pulse: readonly BookOrderStatisticsPulseSignal[],
  format: PulseFormatters,
): PulseItem[] {
  return pulse
    .map((signal, index) => toPulseItem({ format, index, signal }))
    .filter((item): item is PulseItem => item !== null)
    .slice(0, PULSE.maxItems);
}

function changeValue(
  signal: { absoluteDelta: Nullable<number>; currency: Currency; percentDelta: Nullable<number> },
  format: PulseFormatters,
): Nullable<string> {
  if (signal.percentDelta !== null) return format.percent(Math.abs(signal.percentDelta));
  if (signal.absoluteDelta !== null) {
    return format.money(Math.abs(signal.absoluteDelta), signal.currency);
  }
  return null;
}

function direction(absoluteDelta: Nullable<number>): "down" | "flat" | "up" {
  if (absoluteDelta === null || absoluteDelta === 0) return "flat";
  return absoluteDelta > 0 ? "up" : "down";
}

function toPulseItem({
  format,
  index,
  signal,
}: {
  format: PulseFormatters;
  index: number;
  signal: BookOrderStatisticsPulseSignal;
}): Nullable<PulseItem> {
  const id = `${signal.code}-${index}`;

  switch (signal.code) {
    case "avg_book_price_change":
    case "avg_landed_cost_change":
    case "spend_change": {
      const change = changeValue(signal, format);
      const way = direction(signal.absoluteDelta);
      if (way !== "flat" && change === null) return null;
      return {
        id,
        messageKey: `${signal.code}.${way}`,
        tone: signal.tone,
        values: { change: change ?? "", comparison: format.comparison, currency: signal.currency },
      };
    }

    case "delivery_share":
      return {
        id,
        messageKey: "delivery_share.default",
        tone: signal.tone,
        values: {
          percent: format.percent(signal.deliveryShareOfSpendPercent),
          total: format.money(signal.deliveryTotal, signal.currency),
        },
      };

    case "discount_savings":
      return {
        id,
        messageKey:
          signal.discountShareOfRawSubtotalPercent === null
            ? "discount_savings.plain"
            : "discount_savings.withPercent",
        tone: signal.tone,
        values: {
          percent:
            signal.discountShareOfRawSubtotalPercent === null
              ? ""
              : format.percent(signal.discountShareOfRawSubtotalPercent),
          total: format.money(signal.discountTotal, signal.currency),
        },
      };

    case "record_month":
      return {
        id,
        messageKey:
          signal.scope.isPeriodFiltered || signal.scope.isTruncated
            ? "record_month.period"
            : "record_month.allTime",
        tone: signal.tone,
        values: {
          month: format.month(signal.month),
          total: format.money(signal.total, signal.currency),
        },
      };

    case "store_growth": {
      const change = changeValue(signal, format);
      const way = direction(signal.absoluteDelta);
      if (way === "flat" || change === null) return null;
      return {
        id,
        messageKey: `store_growth.${way}`,
        tone: signal.tone,
        values: { change, comparison: format.comparison, store: signal.store },
      };
    }
  }
}

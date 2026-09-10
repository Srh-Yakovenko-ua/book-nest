import type {
  ActiveMoneyAgeBucket,
  ActiveMoneyAgeBucketRow,
  ActiveMoneyAgeResponse,
  Nullable,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";

export type ActiveAgeBreakdown = {
  dated: ActiveAgeRow[];
  total: number;
  unknown: Nullable<ActiveAgeRow>;
};

export type ActiveAgeRow = ActiveMoneyAgeBucketRow & {
  isEmpty: boolean;
  share: number;
};

export const ACTIVE_AGE_PRESENTATION = {
  datedOrder: ["0_7", "8_14", "15_30", "31_plus"],
  icon: { dated: "clock", unknown: "calendar-x" },
  unknownKey: "unknown_date",
} as const satisfies {
  datedOrder: readonly Exclude<ActiveMoneyAgeBucket, "unknown_date">[];
  icon: Record<"dated" | "unknown", UiIconName>;
  unknownKey: Extract<ActiveMoneyAgeBucket, "unknown_date">;
};

export function activeAgeBreakdown(response: ActiveMoneyAgeResponse): ActiveAgeBreakdown {
  const total = response.buckets.reduce((count, bucket) => count + bucket.ordersCount, 0);
  const bucketOf = (key: ActiveMoneyAgeBucket): Nullable<ActiveMoneyAgeBucketRow> =>
    response.buckets.find((bucket) => bucket.key === key) ?? null;

  const toRow = (key: ActiveMoneyAgeBucket): ActiveAgeRow => {
    const bucket = bucketOf(key) ?? emptyBucket(key);

    return {
      ...bucket,
      isEmpty: bucket.ordersCount === 0,
      share: total === 0 ? 0 : bucket.ordersCount / total,
    };
  };

  const unknown = toRow(ACTIVE_AGE_PRESENTATION.unknownKey);

  return {
    dated: ACTIVE_AGE_PRESENTATION.datedOrder.map((key) => toRow(key)),
    total,
    unknown: unknown.isEmpty ? null : unknown,
  };
}

function emptyBucket(key: ActiveMoneyAgeBucket): ActiveMoneyAgeBucketRow {
  return { booksCount: 0, key, ordersCount: 0, shipmentsCount: 0, totalsByCurrency: [] };
}

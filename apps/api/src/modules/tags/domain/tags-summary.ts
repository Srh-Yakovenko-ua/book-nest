import type { Nullable, TagsMostUsedSummary, TagsSummaryView } from "@app/shared";

import { TAG_COLORS, TagTypeSchema } from "@app/shared";

import type { TaggedEntityCounts, TagsSummaryAggregate } from "./tag-usage.js";

export function buildTagsSummary({
  aggregate,
  entityCounts,
}: {
  aggregate: TagsSummaryAggregate;
  entityCounts: TaggedEntityCounts;
}): TagsSummaryView {
  return {
    ...entityCounts,
    colorCounts: zeroFill({ counts: aggregate.colorCounts, keys: TAG_COLORS }),
    mostUsed: selectMostUsed(aggregate),
    totalTagsCount: aggregate.totalTagsCount,
    typeCounts: zeroFill({ counts: aggregate.typeCounts, keys: TagTypeSchema.options }),
    usageDistribution: aggregate.usageDistribution,
  };
}

function selectMostUsed({
  leaders,
  leadersCount,
  topUsageCount,
}: TagsSummaryAggregate): Nullable<TagsMostUsedSummary> {
  if (topUsageCount === 0) return null;
  return { leaders, leadersCount, usageCount: topUsageCount };
}

function zeroFill<const Key extends string>({
  counts,
  keys,
}: {
  counts: Partial<Record<Key, number>>;
  keys: readonly Key[];
}): Record<Key, number> {
  return Object.fromEntries(keys.map((key) => [key, counts[key] ?? 0])) as Record<Key, number>;
}

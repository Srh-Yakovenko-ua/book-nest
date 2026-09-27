import type {
  TagColor,
  TagsMostUsedLeader,
  TagsSummaryView,
  TagType,
  TagUsageDistribution,
} from "@app/shared";

import { TAG_COLORS, TagTypeSchema } from "@app/shared";

import { formatNumber } from "@/lib/format";

export type MostUsedTagFact =
  { hiddenLeadersCount: number; kind: "leader"; leader: TagsMostUsedLeader } | { kind: "none" };

export type TagAttentionState = { count: number; kind: "unused" } | { kind: "allUsed" };

export type TagColorRow = {
  color: TagColor;
  count: number;
  isSelected: boolean;
};

export type TagTypeRow = {
  count: number;
  isEmpty: boolean;
  isSelected: boolean;
  share: number;
  type: TagType;
};

export type TagUsageKey = keyof TagUsageDistribution;

export type TagUsageRow = {
  count: number;
  key: TagUsageKey;
  share: number;
};

const TAG_SHARE_FORMAT = { maximumFractionDigits: 0, style: "percent" } as const;

const TAG_USAGE_ORDER = [
  "booksOnly",
  "charactersOnly",
  "both",
  "unused",
] as const satisfies readonly TagUsageKey[];

export function formatTagShare(share: number, locale: string): string {
  return formatNumber(share, locale, TAG_SHARE_FORMAT);
}

export function mostUsedTagFact(summary: TagsSummaryView): MostUsedTagFact {
  const [leader] = summary.mostUsed?.leaders ?? [];
  if (summary.mostUsed === null || leader === undefined) return { kind: "none" };
  return {
    hiddenLeadersCount: Math.max(0, summary.mostUsed.leadersCount - 1),
    kind: "leader",
    leader,
  };
}

export function shareOf(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0 || part <= 0) return 0;
  return Math.min(1, part / whole);
}

export function tagAttentionState(summary: TagsSummaryView): TagAttentionState {
  const count = summary.usageDistribution.unused;
  return count > 0 ? { count, kind: "unused" } : { kind: "allUsed" };
}

export function tagColorRows(
  summary: TagsSummaryView,
  selected: readonly TagColor[],
): TagColorRow[] {
  return TAG_COLORS.map((color) => ({
    color,
    count: summary.colorCounts[color],
    isSelected: selected.includes(color),
  }));
}

export function tagTypeRows(summary: TagsSummaryView, selected: readonly TagType[]): TagTypeRow[] {
  return TagTypeSchema.options.map((type) => {
    const count = summary.typeCounts[type];
    return {
      count,
      isEmpty: count === 0,
      isSelected: selected.includes(type),
      share: shareOf(count, summary.totalTagsCount),
      type,
    };
  });
}

export function tagUsageRows(summary: TagsSummaryView): TagUsageRow[] {
  return TAG_USAGE_ORDER.map((key) => ({
    count: summary.usageDistribution[key],
    key,
    share: shareOf(summary.usageDistribution[key], summary.totalTagsCount),
  }));
}

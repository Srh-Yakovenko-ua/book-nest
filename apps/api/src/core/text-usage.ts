import { normalizeName } from "@app/shared";

import { UKRAINIAN_COLLATION } from "./ukrainian-collation.js";

export type TextUsage = {
  count: number;
  text: string;
};

type SpellingCounts = Map<string, number>;

type TextUsageGroup = {
  count: number;
  spellings: SpellingCounts;
};

export function mergeTextUsage({
  limit,
  usages,
}: {
  limit: number;
  usages: TextUsage[];
}): TextUsage[] {
  return groupByNormalizedText(usages)
    .map((group) => ({ count: group.count, text: pickDominantSpelling(group.spellings) }))
    .sort(compareTextUsage)
    .slice(0, limit);
}

function compareTextUsage(left: TextUsage, right: TextUsage): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  return UKRAINIAN_COLLATION.compare(left.text, right.text);
}

function groupByNormalizedText(usages: TextUsage[]): TextUsageGroup[] {
  const groups = new Map<string, TextUsageGroup>();

  for (const usage of usages) {
    const text = usage.text.trim();
    if (text.length === 0) {
      continue;
    }
    const key = normalizeName(text);
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += usage.count;
    group.spellings.set(text, (group.spellings.get(text) ?? 0) + usage.count);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function pickDominantSpelling(spellings: SpellingCounts): string {
  let dominant = "";
  let dominantCount = -1;

  for (const [spelling, count] of spellings) {
    if (count > dominantCount || (count === dominantCount && spelling < dominant)) {
      dominant = spelling;
      dominantCount = count;
    }
  }

  return dominant;
}

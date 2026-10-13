import type { CharacterCustomLabelsView, CharacterCustomLabelUsageView } from "@app/shared";

import { CHARACTER_CUSTOM_LABELS_MAX, normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { CustomLabelUsageRow } from "../infrastructure/character-custom-labels.repository.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { CharacterCustomLabelsRepository } from "../infrastructure/character-custom-labels.repository.js";

type LabelGroup = {
  count: number;
  spellings: SpellingCounts;
};

type SpellingCounts = Map<string, number>;

@Injectable()
export class CharacterCustomLabelsService {
  constructor(private readonly characterCustomLabelsRepository: CharacterCustomLabelsRepository) {}

  async getCustomLabels({ userId }: { userId: string }): Promise<CharacterCustomLabelsView> {
    const usage = await this.characterCustomLabelsRepository.findCustomLabelUsage({ userId });
    return {
      roles: mergeLabelUsage({ limit: CHARACTER_CUSTOM_LABELS_MAX.roles, rows: usage.roles }),
      statuses: mergeLabelUsage({
        limit: CHARACTER_CUSTOM_LABELS_MAX.statuses,
        rows: usage.statuses,
      }),
    };
  }
}

function compareLabelUsage(
  left: CharacterCustomLabelUsageView,
  right: CharacterCustomLabelUsageView,
): number {
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  return UKRAINIAN_COLLATION.compare(left.label, right.label);
}

function groupByNormalizedLabel(rows: CustomLabelUsageRow[]): LabelGroup[] {
  const groups = new Map<string, LabelGroup>();

  for (const row of rows) {
    const spelling = row.label.trim();
    if (spelling.length === 0) {
      continue;
    }
    const key = normalizeName(spelling);
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += row.count;
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + row.count);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function mergeLabelUsage({
  limit,
  rows,
}: {
  limit: number;
  rows: CustomLabelUsageRow[];
}): CharacterCustomLabelUsageView[] {
  return groupByNormalizedLabel(rows)
    .map((group) => ({ count: group.count, label: pickDominantSpelling(group.spellings) }))
    .sort(compareLabelUsage)
    .slice(0, limit);
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

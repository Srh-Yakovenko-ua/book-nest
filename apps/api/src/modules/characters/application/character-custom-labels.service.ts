import type { CharacterCustomLabelsView, CharacterCustomLabelUsageView } from "@app/shared";

import { CHARACTER_CUSTOM_LABELS_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { CustomLabelUsageRow } from "../infrastructure/character-custom-labels.repository.js";

import { mergeTextUsage } from "../../../core/text-usage.js";
import { CharacterCustomLabelsRepository } from "../infrastructure/character-custom-labels.repository.js";

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

function mergeLabelUsage({
  limit,
  rows,
}: {
  limit: number;
  rows: CustomLabelUsageRow[];
}): CharacterCustomLabelUsageView[] {
  const merged = mergeTextUsage({
    limit,
    usages: rows.map((row) => ({ count: row.count, text: row.label })),
  });
  return merged.map((usage) => ({ count: usage.count, label: usage.text }));
}

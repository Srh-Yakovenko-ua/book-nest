import type { CatalogLocale, SpeciesOptionView } from "@app/shared";

import { SPECIES_NAME_COLLATORS } from "./species-search.js";

const BROWSE_GROUP = {
  noCategoryKey: "",
  ownRank: 0,
} as const;

type BrowseGroupRanks = {
  categoryRanks: ReadonlyMap<string, number>;
  uncategorizedRank: number;
  unknownCategoryRank: number;
};

type GroupedSpeciesOption = {
  categoryKey: string;
  groupRank: number;
  option: SpeciesOptionView;
};

export function orderSpeciesForBrowse({
  categoryOrder,
  locale,
  options,
}: {
  categoryOrder: readonly string[];
  locale: CatalogLocale;
  options: readonly SpeciesOptionView[];
}): SpeciesOptionView[] {
  const collator = SPECIES_NAME_COLLATORS[locale];
  const ranks = browseGroupRanks(categoryOrder);

  return options
    .map((option) => toGroupedOption({ option, ranks }))
    .sort(
      (left, right) =>
        left.groupRank - right.groupRank ||
        left.categoryKey.localeCompare(right.categoryKey) ||
        collator.compare(left.option.name, right.option.name) ||
        left.option.id.localeCompare(right.option.id),
    )
    .map((grouped) => grouped.option);
}

function browseGroupRanks(categoryOrder: readonly string[]): BrowseGroupRanks {
  const firstCategoryRank = BROWSE_GROUP.ownRank + 1;
  const unknownCategoryRank = firstCategoryRank + categoryOrder.length;
  return {
    categoryRanks: new Map(
      categoryOrder.map((categoryKey, index) => [categoryKey, firstCategoryRank + index]),
    ),
    uncategorizedRank: unknownCategoryRank + 1,
    unknownCategoryRank,
  };
}

function toGroupedOption({
  option,
  ranks,
}: {
  option: SpeciesOptionView;
  ranks: BrowseGroupRanks;
}): GroupedSpeciesOption {
  if (option.isOwn) {
    return { categoryKey: BROWSE_GROUP.noCategoryKey, groupRank: BROWSE_GROUP.ownRank, option };
  }
  if (option.category === null) {
    return {
      categoryKey: BROWSE_GROUP.noCategoryKey,
      groupRank: ranks.uncategorizedRank,
      option,
    };
  }
  return {
    categoryKey: option.category.key,
    groupRank: ranks.categoryRanks.get(option.category.key) ?? ranks.unknownCategoryRank,
    option,
  };
}

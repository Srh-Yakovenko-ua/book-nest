import type { SpeciesOptionView } from "@app/shared";

export type SpeciesGroup = {
  heading: SpeciesGroupHeading;
  key: string;
  options: SpeciesOptionView[];
};

export type SpeciesGroupHeading =
  { kind: "category"; name: string } | { kind: "other" } | { kind: "own" };

const GROUP_KEY = {
  other: "other",
  own: "own",
} as const;

export function groupSpeciesOptions(options: readonly SpeciesOptionView[]): SpeciesGroup[] {
  const groups = new Map<string, SpeciesGroup>();

  for (const option of options) {
    const key = groupKeyOf(option);
    const group = groups.get(key) ?? { heading: headingOf(option), key, options: [] };
    groups.set(key, { ...group, options: [...group.options, option] });
  }

  return [...groups.values()];
}

function groupKeyOf(option: SpeciesOptionView): string {
  if (option.isOwn) return GROUP_KEY.own;
  return option.category === null ? GROUP_KEY.other : `category-${option.category.key}`;
}

function headingOf(option: SpeciesOptionView): SpeciesGroupHeading {
  if (option.isOwn) return { kind: "own" };
  return option.category === null
    ? { kind: "other" }
    : { kind: "category", name: option.category.name };
}

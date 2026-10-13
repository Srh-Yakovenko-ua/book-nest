import type { SpeciesOptionView } from "@app/shared";

import type { SpeciesGroup } from "./species-groups";

import { groupSpeciesOptions } from "./species-groups";

export type SpeciesPickerSection =
  | { group: SpeciesGroup; kind: "group" }
  | { kind: SpeciesPickerListKind; options: SpeciesOptionView[] };

type BrowseSectionsArgs = {
  catalog: SpeciesOptionView[];
  pinned: SpeciesOptionView[];
};

type SearchSectionsArgs = {
  exact: SpeciesOptionView[];
  results: SpeciesOptionView[];
  similar: SpeciesOptionView[];
};

type SpeciesPickerListKind = "exact" | "popular" | "recentOwn" | "similar";

export function browseSections({ catalog, pinned }: BrowseSectionsArgs): SpeciesPickerSection[] {
  const pinnedIds = new Set(pinned.map((option) => option.id));
  const popular = pinned.filter((option) => !option.isOwn);
  const recentOwn = pinned.filter((option) => option.isOwn);
  const uniqueCatalog = [...new Map(catalog.map((option) => [option.id, option])).values()];
  return [
    ...listSection("popular", popular),
    ...listSection("recentOwn", recentOwn),
    ...groupSections(uniqueCatalog.filter((option) => !pinnedIds.has(option.id))),
  ];
}

export function searchSections({
  exact,
  results,
  similar,
}: SearchSectionsArgs): SpeciesPickerSection[] {
  const pinnedIds = new Set([...exact, ...similar].map((option) => option.id));
  return [
    ...listSection("exact", exact),
    ...listSection("similar", similar),
    ...groupSections(results.filter((option) => !pinnedIds.has(option.id))),
  ];
}

export function sectionOptions(section: SpeciesPickerSection): SpeciesOptionView[] {
  return section.kind === "group" ? section.group.options : section.options;
}

function groupSections(options: SpeciesOptionView[]): SpeciesPickerSection[] {
  return groupSpeciesOptions(options).map((group) => ({ group, kind: "group" }));
}

function listSection(
  kind: SpeciesPickerListKind,
  options: SpeciesOptionView[],
): SpeciesPickerSection[] {
  return options.length > 0 ? [{ kind, options }] : [];
}

import type { Nullable } from "@app/shared";
import type { useTranslations } from "next-intl";

import type { GraphGenealogyPresentation } from "../../model/workspace/graph-workspace-presentation";
import type { GraphGenealogyHouseMark } from "./graph-tree-scene-context";

export type GraphGenealogyBranch = {
  count: number;
  id: string;
  kind: "family" | "house";
  label: string;
  tone: Nullable<number>;
};

type WorkspaceTranslator = ReturnType<typeof useTranslations<"relationships.workspace">>;

export function toGenealogyBranches({
  genealogy,
  houseMarks,
  nameOf,
  t,
}: {
  genealogy: GraphGenealogyPresentation;
  houseMarks: ReadonlyMap<string, GraphGenealogyHouseMark>;
  nameOf: (id: string) => string;
  t: WorkspaceTranslator;
}): GraphGenealogyBranch[] {
  const houses = genealogy.scene.houses.flatMap((house): GraphGenealogyBranch[] => {
    const mark = houseMarks.get(house.id);
    if (mark === undefined || house.memberIds.length === 0) return [];
    return [
      {
        count: house.memberIds.length,
        id: house.id,
        kind: "house",
        label: mark.name,
        tone: mark.tone,
      },
    ];
  });
  const families =
    genealogy.scene.components.length < 2
      ? []
      : genealogy.scene.components.map((component): GraphGenealogyBranch => ({
          count: component.memberIds.length,
          id: component.id,
          kind: "family",
          label: toGenealogyFamilyLabel({
            componentId: component.id,
            genealogy,
            houseMarks,
            nameOf,
            t,
          }),
          tone:
            component.houseId === null ? null : (houseMarks.get(component.houseId)?.tone ?? null),
        }));
  return [...houses, ...families];
}

export function toGenealogyBranchMembers({
  branchId,
  genealogy,
}: {
  branchId: string;
  genealogy: GraphGenealogyPresentation;
}): readonly string[] {
  const house = genealogy.scene.houses.find((entry) => entry.id === branchId);
  if (house !== undefined) return house.memberIds;
  return genealogy.scene.components.find((entry) => entry.id === branchId)?.memberIds ?? [];
}

export function toGenealogyFamilyLabel({
  componentId,
  genealogy,
  houseMarks,
  nameOf,
  t,
}: {
  componentId: string;
  genealogy: GraphGenealogyPresentation;
  houseMarks: ReadonlyMap<string, GraphGenealogyHouseMark>;
  nameOf: (id: string) => string;
  t: WorkspaceTranslator;
}): string {
  const component = genealogy.scene.components.find((entry) => entry.id === componentId);
  if (component === undefined) return "";
  const house = component.houseId === null ? undefined : houseMarks.get(component.houseId);
  return house === undefined
    ? t("genealogy.family", { count: component.memberIds.length, name: nameOf(component.titleId) })
    : t("genealogy.familyHouse", { count: component.memberIds.length, name: house.name });
}

export function toGenealogyHiddenIds({
  genealogy,
  isVisible,
}: {
  genealogy: GraphGenealogyPresentation;
  isVisible: (id: string) => boolean;
}): ReadonlySet<string> {
  return new Set(genealogy.allNodes.flatMap((node) => (isVisible(node.id) ? [] : [node.id])));
}

export function toGenealogyHouseMarks(
  genealogy: GraphGenealogyPresentation,
): ReadonlyMap<string, GraphGenealogyHouseMark> {
  const ranked = [...genealogy.scene.houses].sort(
    (left, right) => right.size - left.size || left.id.localeCompare(right.id),
  );
  return new Map(
    ranked.flatMap((house, index) =>
      house.name === null ? [] : [[house.id, { name: house.name, tone: index }] as const],
    ),
  );
}

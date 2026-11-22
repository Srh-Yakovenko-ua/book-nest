"use client";

import type { FamilyTreeLineageKind, RelationshipType } from "@app/shared";

import { useTranslations } from "next-intl";

import type { TreePairSemantics, TreePairStyle } from "../../model/workspace/graph-tree-pairs";
import type { TreeEdgeEntry } from "../../model/workspace/graph-tree-scene";

import { useRelationshipLabels } from "../../model/use-relationship-labels";

const INVERSE_TYPES: Partial<Record<RelationshipType, RelationshipType>> = {
  ancestor_of: "descendant_of",
  descendant_of: "ancestor_of",
  guardian_of: "ward_of",
  ward_of: "guardian_of",
};

const LINEAGE_ROLE_TYPES = {
  adoptive: { child: "adoptive_child_of", parent: "adoptive_parent_of" },
  biological: { child: "biological_child_of", parent: "biological_parent_of" },
  step: { child: "step_child_of", parent: "step_parent_of" },
} as const satisfies Record<
  FamilyTreeLineageKind,
  { child: RelationshipType; parent: RelationshipType }
>;

const GENERATION_CAPTIONS: ReadonlyMap<
  number,
  | "children"
  | "grandchildren"
  | "grandparents"
  | "greatGrandchildren"
  | "greatGrandparents"
  | "parents"
  | "root"
> = new Map([
  [-3, "greatGrandparents"],
  [-2, "grandparents"],
  [-1, "parents"],
  [0, "root"],
  [1, "children"],
  [2, "grandchildren"],
  [3, "greatGrandchildren"],
] as const);

export function useGraphTreeLabels() {
  const t = useTranslations("relationships.workspace.tree");
  const labels = useRelationshipLabels();

  function typeLabel(type: RelationshipType): string {
    return labels.type(type);
  }

  function entry(value: TreeEdgeEntry): string {
    if (value.kind === "lineage") return t(`lineageKinds.${value.lineageKind}`);
    if (value.edge.type === null) return t("styles.distant");
    return typeLabel(value.edge.type);
  }

  function role({ entry: value, perspectiveId }: { entry: TreeEdgeEntry; perspectiveId: string }) {
    if (value.kind === "lineage") {
      const otherIsParent = value.childId === perspectiveId;
      return typeLabel(LINEAGE_ROLE_TYPES[value.lineageKind][otherIsParent ? "parent" : "child"]);
    }
    const { type } = value.edge;
    if (type === null) return t("styles.distant");
    const inverse = INVERSE_TYPES[type];
    const label = typeLabel(
      value.edge.source === perspectiveId && inverse !== undefined ? inverse : type,
    );
    return value.kind === "conflict" ? t("conflictRole", { label }) : label;
  }

  function lineageShort(kind: FamilyTreeLineageKind): string {
    return t(`lineageShort.${kind}`);
  }

  function pair(semantics: TreePairSemantics): string {
    const [single] = semantics.entries;
    if (semantics.relationshipCount === 1 && single !== undefined) return entry(single);
    return t("pairCount", { count: semantics.relationshipCount });
  }

  function style(value: TreePairStyle): string {
    return t(`styles.${value}`);
  }

  function generation(value: number): string {
    return t("generation.label", { value: formatGeneration(value) });
  }

  function generationCaption(value: number): string {
    const caption = GENERATION_CAPTIONS.get(value);
    return caption === undefined ? "" : t(`generation.captions.${caption}`);
  }

  return { entry, generation, generationCaption, lineageShort, pair, role, style };
}

function formatGeneration(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

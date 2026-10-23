"use client";

import type { CharacterGraphEdgeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { useRelationshipLabels } from "../../model/use-relationship-labels";

export function useGraphEdgeLabel(): (edge: CharacterGraphEdgeView) => string {
  const t = useTranslations("relationships.workspace.connection");
  const labels = useRelationshipLabels();

  return (edge) => {
    if (edge.typeHidden || edge.type === null) return t("hidden");
    return labels.edgeType({ customType: null, type: edge.type }) ?? t("custom");
  };
}

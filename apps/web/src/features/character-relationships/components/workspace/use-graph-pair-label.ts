"use client";

import { useTranslations } from "next-intl";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import { useGraphEdgeLabel } from "./use-graph-edge-label";

export function useGraphPairLabel(): (semantics: GraphPairSemantics) => string {
  const t = useTranslations("relationships.workspace.pair");
  const toEdgeLabel = useGraphEdgeLabel();

  return (semantics) => {
    if (semantics.tone === "masked") return t("masked");
    if (semantics.singleEdge !== null) return toEdgeLabel(semantics.singleEdge);
    return t("count", { count: semantics.relationshipCount });
  };
}

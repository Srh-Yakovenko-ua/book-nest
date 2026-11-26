"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";

import { useNetworkBucketLabel } from "./use-network-bucket-label";

export function useGraphCounterText(
  presentation: Nullable<GraphWorkspacePresentation>,
): Nullable<string> {
  const t = useTranslations("relationships.workspace.counters");
  const toBucketLabel = useNetworkBucketLabel();
  if (presentation === null) return null;
  const { counters } = presentation;
  switch (counters.kind) {
    case "genealogy":
      return t("genealogy", {
        generations: counters.generations,
        nodes: counters.nodes,
        pairs: counters.pairs,
      });
    case "networkFocus": {
      const scene = presentation.network?.scene ?? null;
      return t("networkFocus", {
        group: scene?.kind === "focus" ? toBucketLabel(scene.bucket.label) : "",
        members: counters.members,
        neighborGroups: counters.neighborGroups,
        pairs: counters.pairs,
        shownMembers: counters.shownMembers,
      });
    }
    case "networkOverview":
      return t("networkOverview", {
        characters: counters.characters,
        groups: counters.groups,
        pairs: counters.pairs,
        relations: counters.relations,
        shownGroups: counters.shownGroups,
      });
    case "person":
      return t("person", {
        nodes: counters.nodes,
        pairs: counters.pairs,
        relationships: counters.edges,
      });
    case "tree":
      return t("tree", {
        nodes: counters.nodes,
        pairs: counters.pairs,
        relationships: counters.edges,
      });
    default:
      return assertNever(counters);
  }
}

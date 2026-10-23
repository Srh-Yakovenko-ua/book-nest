"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { assertNever } from "@/lib/assert-never";

import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";

export function useGraphCounterText(
  presentation: Nullable<GraphWorkspacePresentation>,
): Nullable<string> {
  const t = useTranslations("relationships.workspace.counters");
  if (presentation === null) return null;
  const { counters } = presentation;
  switch (counters.kind) {
    case "expanded":
      return t("expanded", { edges: counters.edges, nodes: counters.nodes });
    case "groups":
      return t("groups", { groups: counters.groups });
    case "people":
      return t("people", { edges: counters.edges, nodes: counters.nodes });
    default:
      return assertNever(counters);
  }
}

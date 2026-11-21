"use client";

import type { CharacterGraphEdgeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { isMaskedGraphEdge } from "../../model/workspace/graph-person-semantics";
import { GRAPH_PERSON_TONES } from "./graph-person-tones";
import { useGraphEdgeLabel } from "./use-graph-edge-label";

type GraphPersonEdgeRowProps = {
  edge: CharacterGraphEdgeView;
  index: number;
  nameOf: (id: string) => string;
};

export function GraphPersonEdgeRow({ edge, index, nameOf }: GraphPersonEdgeRowProps) {
  const t = useTranslations("relationships.workspace.panel");
  const toLabel = useGraphEdgeLabel();
  const isMasked = isMaskedGraphEdge(edge);
  const tone = GRAPH_PERSON_TONES[isMasked || edge.category === null ? "masked" : edge.category];
  const Icon = tone.icon;

  function toDirectionText(): string {
    if (isMasked || edge.directionality === null) return t("person.direction.unknown");
    if (edge.directionality === "symmetric") return t("person.direction.symmetric");
    return t("person.direction.directed", {
      source: nameOf(edge.source),
      target: nameOf(edge.target),
    });
  }

  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Icon aria-hidden className={cn("size-4 shrink-0", tone.iconColor)} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{toLabel(edge)}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {toDirectionText()}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {t("connection.item", { index: index + 1 })}
      </span>
    </>
  );
}

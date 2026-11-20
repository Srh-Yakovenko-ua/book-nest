"use client";

import { cn } from "@/lib/utils";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import { GRAPH_PERSON_TONES } from "./graph-person-tones";
import { useGraphPairLabel } from "./use-graph-pair-label";

const RELATION_CHIP_STYLES = {
  base: "relative isolate inline-flex max-w-full min-w-0 items-center gap-1 rounded-full font-medium text-foreground",
  size: {
    canvas: "bg-card px-2 py-0.5 text-xs shadow-soft",
    default: "px-2 py-0.5 text-xs",
  },
} as const;

type GraphPersonRelationChipProps = {
  className?: string;
  semantics: GraphPairSemantics;
  size?: keyof typeof RELATION_CHIP_STYLES.size;
};

export function GraphPersonRelationChip({
  className,
  semantics,
  size = "default",
}: GraphPersonRelationChipProps) {
  const toLabel = useGraphPairLabel();
  const tone = GRAPH_PERSON_TONES[semantics.tone];
  const Icon = tone.icon;

  return (
    <span className={cn(RELATION_CHIP_STYLES.base, RELATION_CHIP_STYLES.size[size], className)}>
      <span aria-hidden className={cn("absolute inset-0 -z-10 rounded-full border", tone.chip)} />
      <Icon aria-hidden className={cn("size-3.5 shrink-0", tone.iconColor)} />
      <span className="min-w-0 truncate">{toLabel(semantics)}</span>
    </span>
  );
}

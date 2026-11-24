"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { cn } from "@/lib/utils";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { useGraphNetworkScene } from "./graph-network-scene-context";
import { useGraphScene } from "./graph-scene-context";
import { useNetworkBucketLabel } from "./use-network-bucket-label";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const CLUSTER_NODE_STYLES = {
  card: "flex h-24 w-44 cursor-pointer flex-col justify-center gap-1 rounded-2xl border px-3 text-left text-foreground shadow-sm transition outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
  count: "text-xs font-medium",
  dimmed: {
    neighbor: "border-border/50 bg-card/50 text-muted-foreground shadow-none",
    overview: "border-border/50 bg-muted/50 text-muted-foreground shadow-none",
  },
  emphasized: "border-primary ring-2 ring-primary/30",
  handle: "opacity-0",
  name: "flex min-w-0 items-start gap-1.5 text-sm leading-tight font-semibold zoom-overview:text-base",
  role: {
    neighbor: "border-dashed border-border bg-card/90",
    overview: "border-border bg-muted",
  },
  selected: "border-primary",
  summary: "text-xs text-muted-foreground zoom-overview:hidden",
} as const;

export function GraphClusterNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.network.cluster");
  const { clusters, onClusterOpen, selection } = useGraphScene();
  const { emphasis } = useGraphNetworkScene();
  const toLabel = useNetworkBucketLabel();
  const revealOnFocus = useRevealOnFocus(id);
  const cluster = clusters.get(id);
  if (cluster === undefined) return null;

  const name = toLabel(cluster.bucket.label);
  const count = cluster.bucket.memberIds.length;
  const { internalPairCount, linkedBucketCount } = cluster.summary;
  const focusPairs = cluster.focusPairCount ?? 0;
  const isSelected = selection?.kind === "members" && selection.id === id;
  const isEmphasized = emphasis?.characterIds.has(id) ?? false;
  const isDimmed = emphasis !== null && !isEmphasized && !isSelected;
  const label =
    cluster.role === "neighbor"
      ? t("openNeighbor", { count, name, pairs: focusPairs })
      : t("open", { count, linked: linkedBucketCount, name, pairs: internalPairCount });

  return (
    <div className="relative">
      <Handle
        className={CLUSTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-label={label}
        className={cn(
          CLUSTER_NODE_STYLES.card,
          CLUSTER_NODE_STYLES.role[cluster.role],
          isSelected && CLUSTER_NODE_STYLES.selected,
          isEmphasized && CLUSTER_NODE_STYLES.emphasized,
          isDimmed && CLUSTER_NODE_STYLES.dimmed[cluster.role],
        )}
        onClick={() => onClusterOpen(id)}
        onFocus={revealOnFocus}
        type="button"
      >
        <span aria-hidden className={CLUSTER_NODE_STYLES.name}>
          <UiIcon
            className="mt-0.5 shrink-0 text-muted-foreground zoom-overview:hidden"
            name="users-round"
            size={14}
          />
          <TruncatedText lines={2} text={name} />
        </span>
        <span aria-hidden className={CLUSTER_NODE_STYLES.count}>
          {t("members", { count })}
        </span>
        <span aria-hidden className={CLUSTER_NODE_STYLES.summary}>
          {cluster.role === "neighbor"
            ? t("withFocus", { count: focusPairs })
            : t("summary", { linked: linkedBucketCount, pairs: internalPairCount })}
        </span>
      </button>
      <Handle
        className={CLUSTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

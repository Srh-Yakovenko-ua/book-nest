"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { cn } from "@/lib/utils";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { useGraphScene } from "./graph-scene-context";
import { useNetworkBucketLabel } from "./use-network-bucket-label";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const CLUSTER_NODE_STYLES = {
  card: "flex h-24 w-44 cursor-pointer items-center gap-2 rounded-2xl border border-border bg-muted px-3 text-left text-foreground shadow-sm outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  expanded: "border-primary bg-card",
  handle: "opacity-0",
  more: "nodrag nopan absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 cursor-pointer rounded-full border border-border bg-background px-2.5 text-xs whitespace-nowrap text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
} as const;

export function GraphClusterNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.cluster");
  const tMore = useTranslations("relationships.workspace.more");
  const { clusters, onClusterMore, onClusterToggle } = useGraphScene();
  const toLabel = useNetworkBucketLabel();
  const revealOnFocus = useRevealOnFocus(id);
  const cluster = clusters.get(id);
  if (cluster === undefined) return null;

  const label = toLabel(cluster.bucket.label);
  const count = cluster.bucket.memberIds.length;

  return (
    <div className="relative">
      <Handle
        className={CLUSTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-expanded={cluster.isExpanded}
        aria-label={t(cluster.isExpanded ? "collapse" : "expand", { count, name: label })}
        className={cn(CLUSTER_NODE_STYLES.card, cluster.isExpanded && CLUSTER_NODE_STYLES.expanded)}
        onClick={() => onClusterToggle(id)}
        onFocus={revealOnFocus}
        type="button"
      >
        <UiIcon className="shrink-0 text-muted-foreground" name="users-round" size={18} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">
            <TruncatedText lines={2} text={label} />
          </span>
          <span className="text-xs text-muted-foreground">{t("members", { count })}</span>
        </span>
        <UiIcon
          className="shrink-0 text-muted-foreground"
          name={cluster.isExpanded ? "chevron-up" : "chevron-down"}
          size={14}
        />
      </button>
      {cluster.isExpanded && cluster.hasMoreMembers ? (
        <button
          className={CLUSTER_NODE_STYLES.more}
          onClick={(event) => {
            event.stopPropagation();
            onClusterMore(id);
          }}
          type="button"
        >
          {tMore("members")}
        </button>
      ) : null}
      <Handle
        className={CLUSTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

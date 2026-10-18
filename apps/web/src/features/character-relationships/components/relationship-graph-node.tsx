"use client";

import type { BookCharacterImportance } from "@app/shared";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { RelationshipGraphFlowNode } from "../model/relationship-graph-flow";
import type { RelationshipGraphEmphasis } from "../model/relationship-graph-path";

import { useRelationshipGraphCanvas } from "./relationship-graph-canvas-context";

const GRAPH_NODE_STYLES = {
  active: "bg-accent text-accent-foreground ring-2 ring-ring",
  base: "flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
  emphasis: {
    default: "",
    dimmed: "opacity-40",
    path: "border-primary text-primary ring-2 ring-primary",
  },
  handle: "opacity-0",
  importance: {
    central: "border-2 px-4 py-2 text-sm font-semibold",
    episodic: "px-3 py-1.5 text-xs text-muted-foreground",
    major: "px-3.5 py-2 text-sm font-semibold",
    mentioned: "px-2.5 py-1 text-xs text-muted-foreground",
    not_specified: "px-3 py-1.5 text-xs font-medium",
    supporting: "px-3 py-1.5 text-xs font-medium",
  },
  unspecifiedImportance: "not_specified",
} as const satisfies {
  active: string;
  base: string;
  emphasis: Record<RelationshipGraphEmphasis, string>;
  handle: string;
  importance: Record<BookCharacterImportance, string>;
  unspecifiedImportance: BookCharacterImportance;
};

export function RelationshipGraphNode({ id }: NodeProps<RelationshipGraphFlowNode>) {
  const t = useTranslations("relationships.graph.node");
  const { nodes, onNodeOpen } = useRelationshipGraphCanvas();
  const presentation = nodes.get(id);
  if (presentation === undefined) return null;

  const { emphasis, isActive, node, tone } = presentation;
  const importance = node.importance ?? GRAPH_NODE_STYLES.unspecifiedImportance;

  return (
    <>
      <Handle
        className={GRAPH_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-label={t(node.isFavorite ? "openFavorite" : "open", { name: node.name })}
        className={cn(
          GRAPH_NODE_STYLES.base,
          GRAPH_NODE_STYLES.importance[importance],
          tone?.border,
          GRAPH_NODE_STYLES.emphasis[emphasis],
          isActive && GRAPH_NODE_STYLES.active,
        )}
        onClick={() => onNodeOpen(id)}
        type="button"
      >
        {node.isFavorite ? <UiIcon className="text-favorite" name="heart-fill" size={12} /> : null}
        <span className="max-w-40 truncate">{node.name}</span>
      </button>
      <Handle
        className={GRAPH_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </>
  );
}

"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { useGraphNetworkScene } from "./graph-network-scene-context";
import { useGraphScene } from "./graph-scene-context";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const CHARACTER_NODE_STYLES = {
  avatar:
    "size-12 transition-opacity zoom-overview:size-16 zoom-details:size-10 motion-reduce:transition-none",
  card: "flex h-28 w-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border bg-card p-2 text-center text-foreground shadow-sm transition outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
  dimmed: {
    avatar: "opacity-50",
    card: "border-border/50 bg-card/50 text-muted-foreground shadow-none",
  },
  emphasized: "border-primary/60",
  handle: "opacity-0",
  name: "flex w-full min-w-0 items-start justify-center gap-1 text-xs leading-tight font-medium zoom-overview:hidden",
  pairs: "hidden text-xs text-muted-foreground zoom-details:block",
  selected: "border-primary ring-2 ring-primary/30",
} as const;

export function GraphCharacterNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.network.node");
  const { characters, onCharacterOpen, selection } = useGraphScene();
  const { emphasis, index } = useGraphNetworkScene();
  const revealOnFocus = useRevealOnFocus(id);
  const presentation = characters.get(id);
  if (presentation === undefined) return null;

  const { node } = presentation;
  const name = node.displayName;
  const pairs = index.connectionIdsByNodeId.get(id)?.length ?? 0;
  const isSelected = selection?.kind === "character" && selection.id === id;
  const isEmphasized = emphasis?.characterIds.has(id) ?? false;
  const isDimmed = emphasis !== null && !isEmphasized && !isSelected;

  return (
    <div className="relative">
      <Handle
        className={CHARACTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-current={isSelected ? "true" : undefined}
        aria-label={t(node.isFavorite ? "openFavorite" : "open", { name, pairs })}
        className={cn(
          CHARACTER_NODE_STYLES.card,
          isSelected ? CHARACTER_NODE_STYLES.selected : "border-border",
          isEmphasized && !isSelected && CHARACTER_NODE_STYLES.emphasized,
          isDimmed && CHARACTER_NODE_STYLES.dimmed.card,
        )}
        onClick={() => onCharacterOpen(id)}
        onFocus={revealOnFocus}
        type="button"
      >
        <Avatar
          className={cn(
            CHARACTER_NODE_STYLES.avatar,
            isDimmed && CHARACTER_NODE_STYLES.dimmed.avatar,
          )}
        >
          {node.displayMedia === null ? null : (
            <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
          )}
          <AvatarFallback>{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span aria-hidden className={CHARACTER_NODE_STYLES.name}>
          {node.isFavorite ? (
            <UiIcon className="mt-0.5 shrink-0 text-favorite" name="heart-fill" size={10} />
          ) : null}
          <TruncatedText lines={2} text={name} />
        </span>
        <span aria-hidden className={CHARACTER_NODE_STYLES.pairs}>
          {t("pairs", { count: pairs })}
        </span>
      </button>
      <Handle
        className={CHARACTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

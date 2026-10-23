"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { useGraphScene } from "./graph-scene-context";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const CHARACTER_NODE_STYLES = {
  avatar: { default: "size-12", root: "size-14" },
  branch:
    "nodrag nopan absolute -bottom-3 left-1/2 flex size-6 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
  card: "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border bg-card px-2 pt-3 pb-2 text-center text-foreground shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
  handle: "opacity-0",
  root: "ring-2 ring-primary ring-offset-2 ring-offset-card",
  selected: "border-primary shadow-md",
  size: { default: "h-28 w-36", root: "h-32 w-40" },
  wrapper: "relative",
} as const;

export function GraphCharacterNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.node");
  const { characters, onBranchToggle, onCharacterOpen, selection } = useGraphScene();
  const revealOnFocus = useRevealOnFocus(id);
  const presentation = characters.get(id);
  if (presentation === undefined) return null;

  const { canCollapse, canExpand, isRoot, node } = presentation;
  const isSelected = selection?.kind === "character" && selection.id === id;
  const variant = isRoot ? "root" : "default";
  const name = node.displayName;
  const label = isRoot
    ? t("openRoot", { name })
    : t(node.isFavorite ? "openFavorite" : "open", { name });

  return (
    <div className={CHARACTER_NODE_STYLES.wrapper}>
      <Handle
        className={CHARACTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-label={label}
        className={cn(
          CHARACTER_NODE_STYLES.card,
          CHARACTER_NODE_STYLES.size[variant],
          isSelected ? CHARACTER_NODE_STYLES.selected : "border-border",
        )}
        onClick={() => onCharacterOpen(id)}
        onFocus={revealOnFocus}
        type="button"
      >
        <Avatar
          className={cn(
            CHARACTER_NODE_STYLES.avatar[variant],
            isRoot && CHARACTER_NODE_STYLES.root,
          )}
        >
          {node.displayMedia === null ? null : (
            <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
          )}
          <AvatarFallback>{node.displayName.trim().charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="flex w-full min-w-0 items-start justify-center gap-1 text-xs leading-tight font-medium">
          {node.isFavorite ? (
            <UiIcon className="mt-0.5 shrink-0 text-favorite" name="heart-fill" size={10} />
          ) : null}
          <TruncatedText lines={2} text={node.displayName} />
        </span>
      </button>
      {canExpand || canCollapse ? (
        <button
          aria-label={t(canExpand ? "expand" : "collapse", { name: node.displayName })}
          className={CHARACTER_NODE_STYLES.branch}
          onClick={(event) => {
            event.stopPropagation();
            onBranchToggle(id);
          }}
          type="button"
        >
          <UiIcon name={canExpand ? "plus" : "minus"} size={12} />
        </button>
      ) : null}
      <Handle
        className={CHARACTER_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

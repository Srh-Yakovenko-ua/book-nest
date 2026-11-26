"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { toTreeNodeBox } from "../../model/workspace/graph-tree-layout";
import { useGraphScene } from "./graph-scene-context";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const TREE_NODE_STYLES = {
  avatar: {
    default: "size-13 border-2 border-card shadow-soft ring-1 ring-border",
    root: "size-18 border-2 border-card shadow-soft ring-2 ring-primary",
  },
  button:
    "group/tree relative flex size-full cursor-pointer items-center gap-2.5 rounded-full border bg-card pr-4 text-left shadow-soft transition-shadow outline-none hover:shadow-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none",
  fallback: { default: "text-lg", root: "font-heading text-2xl" },
  favorite:
    "absolute top-0 left-0 flex size-5 items-center justify-center rounded-full border border-card bg-favorite-soft text-favorite",
  frame: {
    default: "border-border pl-1.5",
    root: "border-2 border-primary bg-primary/10 pl-1.5 shadow-card",
    side: "border-dashed border-muted-foreground/60 pl-1.5",
  },
  handle: "opacity-0",
  name: {
    default: "text-sm leading-tight font-medium text-foreground",
    root: "font-heading text-base leading-tight font-semibold text-ink",
  },
  selected: "ring-3 ring-ring ring-offset-2 ring-offset-card",
  tag: "inline-flex w-fit items-center gap-1 rounded-full px-2 py-px text-xs leading-tight",
} as const;

export function GraphTreeNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.tree.node");
  const { characters, onCharacterOpen, selection } = useGraphScene();
  const { sideIds } = useGraphTreeScene();
  const revealOnFocus = useRevealOnFocus(id);
  const presentation = characters.get(id);
  if (presentation === undefined) return null;

  const { isRoot, node } = presentation;
  const isSide = sideIds.has(id);
  const variant = isRoot ? "root" : "default";
  const frame = toFrame({ isRoot, isSide });
  const isSelected = selection?.kind === "character" && selection.id === id;
  const name = node.displayName;
  const box = toTreeNodeBox(isRoot);
  const label = t(toLabelKey({ isFavorite: node.isFavorite, isRoot, isSide }), { name });

  return (
    <div style={{ height: box.height, width: box.width }}>
      <Handle
        className={TREE_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-current={isSelected ? "true" : undefined}
        aria-label={label}
        className={cn(
          TREE_NODE_STYLES.button,
          TREE_NODE_STYLES.frame[frame],
          isSelected && TREE_NODE_STYLES.selected,
        )}
        onClick={() => onCharacterOpen(id)}
        onFocus={revealOnFocus}
        type="button"
      >
        <span className="relative shrink-0">
          <Avatar className={TREE_NODE_STYLES.avatar[variant]}>
            {node.displayMedia === null ? null : (
              <AvatarImage
                alt=""
                className="object-cover"
                src={isRoot ? node.displayMedia.urls.card : node.displayMedia.urls.thumb}
              />
            )}
            <AvatarFallback className={TREE_NODE_STYLES.fallback[variant]}>
              {name.trim().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {node.isFavorite ? (
            <span aria-hidden className={TREE_NODE_STYLES.favorite}>
              <UiIcon name="heart-fill" size={10} />
            </span>
          ) : null}
        </span>
        <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-1">
          <TruncatedText className={TREE_NODE_STYLES.name[variant]} lines={2} text={name} />
          {isRoot ? (
            <span className={cn(TREE_NODE_STYLES.tag, "bg-primary/15 font-medium text-primary")}>
              <Crown aria-hidden className="size-3 shrink-0" />
              {t("root")}
            </span>
          ) : null}
          {isSide ? (
            <span className={cn(TREE_NODE_STYLES.tag, "bg-muted text-muted-foreground")}>
              {t("side")}
            </span>
          ) : null}
        </span>
      </button>
      <Handle
        className={TREE_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

function toFrame({
  isRoot,
  isSide,
}: {
  isRoot: boolean;
  isSide: boolean;
}): keyof typeof TREE_NODE_STYLES.frame {
  if (isRoot) return "root";
  return isSide ? "side" : "default";
}

function toLabelKey({
  isFavorite,
  isRoot,
  isSide,
}: {
  isFavorite: boolean;
  isRoot: boolean;
  isSide: boolean;
}): "open" | "openFavorite" | "openRoot" | "openSide" {
  if (isRoot) return "openRoot";
  if (isSide) return "openSide";
  return isFavorite ? "openFavorite" : "open";
}

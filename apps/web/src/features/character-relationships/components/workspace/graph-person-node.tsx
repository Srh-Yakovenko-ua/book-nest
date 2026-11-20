"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { GraphSceneFlowNode } from "./graph-scene-context";

import { useGraphPersonScene } from "./graph-person-scene-context";
import { useGraphScene } from "./graph-scene-context";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const PERSON_NODE_STYLES = {
  avatar: "size-full border-2 border-card",
  avatarDimmed: "opacity-35",
  branch:
    "nodrag nopan absolute -right-1 bottom-0 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft outline-none after:absolute after:-inset-2.5 after:rounded-full hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
  button:
    "group/person relative flex cursor-pointer items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
  fallback: { default: "text-lg", root: "font-heading text-3xl" },
  favorite:
    "absolute -top-0.5 -left-0.5 flex size-5 items-center justify-center rounded-full border border-card bg-favorite-soft text-favorite",
  frame: {
    default: "size-18 bg-card p-0.5 shadow-soft ring-1 ring-border",
    root: "size-28 bg-primary/15 p-1 shadow-card ring-2 ring-primary",
  },
  handle: "opacity-0",
  hovered: "shadow-hover ring-2 ring-accent-border",
  plate: {
    default: "max-w-32 rounded-xl border border-border bg-card/95 px-2 py-0.5 text-xs font-medium",
    root: "max-w-44 rounded-xl border border-primary/40 bg-card px-3 py-1 text-sm font-semibold text-ink shadow-soft",
  },
  plateDimmed: "text-muted-foreground",
  plateWrap:
    "pointer-events-none absolute top-full left-1/2 mt-1.5 flex w-max -translate-x-1/2 items-center justify-center gap-1 text-center leading-tight text-foreground",
  selected: "ring-3 ring-ring ring-offset-2 ring-offset-card",
  wrapper: "relative transition-opacity duration-200 motion-reduce:transition-none",
} as const;

export function GraphPersonNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.node");
  const { characters, onBranchToggle, onCharacterOpen, selection } = useGraphScene();
  const { emphasis, onFocusChange } = useGraphPersonScene();
  const revealOnFocus = useRevealOnFocus(id);
  const presentation = characters.get(id);
  if (presentation === undefined) return null;

  const { canCollapse, canExpand, isRoot, node } = presentation;
  const variant = isRoot ? "root" : "default";
  const isSelected = selection?.kind === "character" && selection.id === id;
  const isDimmed = emphasis !== null && !emphasis.characterIds.has(id);
  const name = node.displayName;
  const label = isRoot
    ? t("openRoot", { name })
    : t(node.isFavorite ? "openFavorite" : "open", { name });

  return (
    <div className={PERSON_NODE_STYLES.wrapper}>
      <Handle
        className={PERSON_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <button
        aria-current={isSelected ? "true" : undefined}
        aria-label={label}
        className={cn(
          PERSON_NODE_STYLES.button,
          PERSON_NODE_STYLES.frame[variant],
          emphasis?.characterIds.has(id) && !isSelected && PERSON_NODE_STYLES.hovered,
          isSelected && PERSON_NODE_STYLES.selected,
        )}
        onBlur={() => onFocusChange(null)}
        onClick={() => onCharacterOpen(id)}
        onFocus={(event) => {
          revealOnFocus(event);
          if (event.currentTarget.matches(":focus-visible")) {
            onFocusChange({ id, kind: "character" });
          }
        }}
        onMouseEnter={() => onFocusChange({ id, kind: "character" })}
        onMouseLeave={() => onFocusChange(null)}
        type="button"
      >
        <Avatar
          className={cn(PERSON_NODE_STYLES.avatar, isDimmed && PERSON_NODE_STYLES.avatarDimmed)}
        >
          {node.displayMedia === null ? null : (
            <AvatarImage
              alt=""
              className="object-cover"
              src={isRoot ? node.displayMedia.urls.card : node.displayMedia.urls.thumb}
            />
          )}
          <AvatarFallback className={PERSON_NODE_STYLES.fallback[variant]}>
            {name.trim().charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {node.isFavorite ? (
          <span aria-hidden className={PERSON_NODE_STYLES.favorite}>
            <UiIcon name="heart-fill" size={10} />
          </span>
        ) : null}
        <span aria-hidden className={PERSON_NODE_STYLES.plateWrap}>
          <span
            className={cn(
              "flex items-center gap-1",
              PERSON_NODE_STYLES.plate[variant],
              isDimmed && PERSON_NODE_STYLES.plateDimmed,
            )}
          >
            {isRoot ? <Crown aria-hidden className="size-3.5 shrink-0 text-primary" /> : null}
            <TruncatedText lines={2} text={name} />
          </span>
        </span>
      </button>
      {canExpand || canCollapse ? (
        <button
          aria-label={t(canExpand ? "expand" : "collapse", { name })}
          className={PERSON_NODE_STYLES.branch}
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
        className={PERSON_NODE_STYLES.handle}
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

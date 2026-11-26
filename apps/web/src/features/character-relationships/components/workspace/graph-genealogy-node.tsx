"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { Handle, type NodeProps, Position, useStore } from "@xyflow/react";
import { ChevronsDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { GenealogyZoomLevel } from "../../model/workspace/graph-genealogy-camera";
import type { GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphGenealogyHouseMark } from "./graph-tree-scene-context";

import {
  toGenealogyShortName,
  toGenealogyZoomLevel,
} from "../../model/workspace/graph-genealogy-camera";
import { TREE_LAYOUT } from "../../model/workspace/graph-tree-layout";
import { toGraphGenealogyHouseTone } from "./graph-genealogy-tones";
import { useGraphScene } from "./graph-scene-context";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { useRevealOnFocus } from "./use-reveal-on-focus";

const GENEALOGY_NODE_STYLES = {
  button:
    "relative flex size-full cursor-pointer items-center overflow-hidden rounded-full border bg-card text-left shadow-soft transition-shadow outline-none hover:shadow-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none",
  chip: "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-px text-xs leading-tight text-foreground",
  collapsed:
    "absolute -bottom-7 left-1/2 flex min-h-6 -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full whitespace-nowrap border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-soft outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  frame: {
    default: "border-border",
    focus: "border-2 border-primary bg-primary/10",
    side: "border-dashed border-muted-foreground",
  },
  highlighted: "ring-2 ring-primary/70 ring-offset-2 ring-offset-card",
  selected: "ring-3 ring-ring ring-offset-2 ring-offset-card",
  stripe: "absolute inset-y-0 left-0 w-1.5",
} as const;

export function GraphGenealogyNode({ id }: NodeProps<GraphSceneFlowNode>) {
  const t = useTranslations("relationships.workspace.genealogy.node");
  const { characters, onCharacterOpen, selection } = useGraphScene();
  const { genealogy, rootId, sideIds } = useGraphTreeScene();
  const level = useStore((state) => toGenealogyZoomLevel(state.transform[2]));
  const revealOnFocus = useRevealOnFocus(id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const presentation = characters.get(id);
  if (presentation === undefined || genealogy === null) return null;

  const { node } = presentation;
  const house = genealogy.houseById.get(id) ?? null;
  const hidden = genealogy.hiddenDescendantsById.get(id) ?? 0;
  const isSelected = selection?.kind === "character" && selection.id === id;
  const isSide = sideIds.has(id);
  const isDimmed = genealogy.highlightIds !== null && !genealogy.highlightIds.has(id);
  const isHighlighted = genealogy.highlightIds?.has(id) === true;
  const frame = toFrame({ isFocus: rootId === id, isSide });
  const box = TREE_LAYOUT.node.default;
  const label = [
    t(node.isFavorite ? "openFavorite" : "open", { name: node.displayName }),
    house === null ? null : house.name,
    isSide ? t("side") : null,
    hidden > 0 ? t("collapsedState", { count: hidden }) : null,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <div
      className={cn(
        "transition-opacity motion-reduce:transition-none",
        isDimmed && "opacity-75 grayscale",
      )}
      style={{ height: box.height, width: box.width }}
    >
      <Handle className="opacity-0" isConnectable={false} position={Position.Top} type="target" />
      <button
        aria-current={isSelected ? "true" : undefined}
        aria-label={label}
        className={cn(
          GENEALOGY_NODE_STYLES.button,
          GENEALOGY_NODE_STYLES.frame[frame],
          isHighlighted && !isSelected && GENEALOGY_NODE_STYLES.highlighted,
          isSelected && GENEALOGY_NODE_STYLES.selected,
        )}
        onClick={() => onCharacterOpen(id)}
        onFocus={revealOnFocus}
        ref={buttonRef}
        type="button"
      >
        {house === null ? null : (
          <span
            aria-hidden
            className={cn(
              GENEALOGY_NODE_STYLES.stripe,
              toGraphGenealogyHouseTone(house.tone).stripe,
            )}
          />
        )}
        <NodeContent house={house} isSide={isSide} level={level} node={node} />
      </button>
      {hidden > 0 ? (
        <button
          aria-label={t("expand", { count: hidden, name: node.displayName })}
          className={GENEALOGY_NODE_STYLES.collapsed}
          onClick={() => {
            buttonRef.current?.focus();
            genealogy.onExpand(id);
          }}
          type="button"
        >
          <ChevronsDown aria-hidden className="size-3.5" />
          <span className="tabular-nums">{t("hidden", { count: hidden })}</span>
        </button>
      ) : null}
      <Handle
        className="opacity-0"
        isConnectable={false}
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

function NodeContent({
  house,
  isSide,
  level,
  node,
}: {
  house: Nullable<GraphGenealogyHouseMark>;
  isSide: boolean;
  level: GenealogyZoomLevel;
  node: CharacterGraphNodeView;
}) {
  const t = useTranslations("relationships.workspace.genealogy.node");
  const initial = node.displayName.trim().charAt(0).toUpperCase();

  if (level === "overview") {
    return (
      <span aria-hidden className="flex size-full items-center gap-3 pr-5 pl-3">
        <span
          className={cn(
            "size-10 shrink-0 rounded-full",
            house === null ? "bg-muted-foreground/70" : toGraphGenealogyHouseTone(house.tone).dot,
          )}
        />
        <span className="h-4 flex-1 rounded-full bg-muted-foreground/40" />
      </span>
    );
  }

  const shortName = toGenealogyShortName({
    displayName: node.displayName,
    houseName: house?.name ?? null,
  });
  const caption = shortName.qualifier ?? house?.name ?? null;

  return (
    <span aria-hidden className="flex size-full min-w-0 items-center gap-2.5 pr-4 pl-3">
      <span className="relative shrink-0">
        <Avatar
          className={cn(
            "border-2 border-card shadow-soft ring-1 ring-border",
            level === "exploration" ? "size-12" : "size-13",
          )}
        >
          {node.displayMedia === null ? null : (
            <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
          )}
          <AvatarFallback className="text-lg">{initial}</AvatarFallback>
        </Avatar>
        {node.isFavorite ? (
          <span className="absolute top-0 left-0 flex size-5 items-center justify-center rounded-full border border-card bg-favorite-soft text-favorite">
            <UiIcon name="heart-fill" size={10} />
          </span>
        ) : null}
      </span>
      {level === "exploration" ? (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-heading text-2xl leading-tight font-semibold text-ink">
            {shortName.name}
          </span>
          {caption === null ? null : (
            <span className="truncate text-base leading-tight text-muted-foreground">
              {caption}
            </span>
          )}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <TruncatedText
            className="text-sm leading-tight font-medium text-foreground"
            lines={2}
            text={node.displayName}
          />
          {house === null && !isSide ? null : (
            <span className="flex min-w-0 flex-wrap gap-1">
              {house === null ? null : (
                <span
                  className={cn(
                    GENEALOGY_NODE_STYLES.chip,
                    toGraphGenealogyHouseTone(house.tone).chip,
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      toGraphGenealogyHouseTone(house.tone).dot,
                    )}
                  />
                  <span className="truncate">{house.name}</span>
                </span>
              )}
              {isSide ? (
                <span className={cn(GENEALOGY_NODE_STYLES.chip, "bg-muted text-muted-foreground")}>
                  {t("side")}
                </span>
              ) : null}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function toFrame({
  isFocus,
  isSide,
}: {
  isFocus: boolean;
  isSide: boolean;
}): keyof typeof GENEALOGY_NODE_STYLES.frame {
  if (isFocus) return "focus";
  return isSide ? "side" : "default";
}

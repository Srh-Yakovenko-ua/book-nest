"use client";

import type { Nullable } from "@app/shared";

import { useStore, ViewportPortal } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { TreeRailCard, TreeRailPlacement } from "../../model/workspace/graph-tree-rail";

import {
  isKeyGeneration,
  toGenealogyLabelStep,
} from "../../model/workspace/graph-genealogy-camera";
import { TREE_CAMERA } from "../../model/workspace/graph-tree-camera";
import { TREE_LAYOUT } from "../../model/workspace/graph-tree-layout";
import { toTreeRailPlacement, toTreeRailRowCards } from "../../model/workspace/graph-tree-rail";
import { useGraphTreeScene } from "./graph-tree-scene-context";
import { useGraphTreeLabels } from "./use-graph-tree-labels";

const GENERATION_RAIL = {
  bandInset: 14,
  bandPadding: 32,
  fallbackLabelWidth: 120,
  labelGap: 16,
  labelInset: 12,
  minRowHeight: 48,
} as const;

const RAIL_LABEL_STYLES = {
  base: "absolute flex -translate-y-1/2 flex-col gap-0.5 border border-border/70 bg-card/95 whitespace-nowrap shadow-soft",
  chip: "rounded-md px-1.5 py-0.5",
  chipTitle: "font-heading text-xs leading-none font-semibold text-ink",
  row: "rounded-xl px-2.5 py-1",
  rowTitle: "font-heading text-sm leading-tight font-semibold text-ink",
} as const;

type RailRow = {
  caption: string;
  placement: TreeRailPlacement;
  row: number;
  rowTop: number;
  title: string;
};

export function GraphTreeGenerationRail() {
  const { genealogy, rows } = useGraphTreeScene();
  const labels = useGraphTreeLabels();
  const translateX = useStore((state) => state.transform[0]);
  const translateY = useStore((state) => state.transform[1]);
  const zoom = useStore((state) => state.transform[2]);
  const cardsKey = useStore((state) =>
    [...state.nodeLookup.values()]
      .map((node) => {
        const { x, y } = node.internals.positionAbsolute;
        const width = node.measured.width ?? 0;
        const height = node.measured.height ?? 0;
        return [x, y, width, height].map((value) => Math.round(value)).join(",");
      })
      .join(";"),
  );
  const labelWidths = useRailLabelWidths();
  const cards = toCards(cardsKey);
  if (cards.length === 0) return null;
  const left = Math.min(...cards.map((card) => card.x)) - TREE_CAMERA.rail;
  const right = Math.max(...cards.map((card) => card.x + card.width));
  const width = right - left + GENERATION_RAIL.bandPadding;
  const height = TREE_LAYOUT.rowStep - GENERATION_RAIL.bandInset * 2;
  const confirmed = rows.flatMap((row) =>
    row.generation === null ? [] : [{ generation: row.generation, row: row.row, y: row.y }],
  );
  const isGenealogy = genealogy !== null;
  const rowHeight = TREE_LAYOUT.rowStep * zoom;
  const step = isGenealogy ? toGenealogyLabelStep(rowHeight) : 1;
  const showLabels = isGenealogy || rowHeight >= GENERATION_RAIL.minRowHeight;
  const labelLeft = Math.max(
    GENERATION_RAIL.labelInset,
    left * zoom + translateX + GENERATION_RAIL.labelGap,
  );
  const transform = { x: translateX, y: translateY, zoom };
  const railRows = confirmed.flatMap((row): RailRow[] => {
    if (step > 1 && !isKeyGeneration({ generation: row.generation, step })) return [];
    const rowTop = row.y * zoom + translateY;
    const placement: TreeRailPlacement =
      step > 1
        ? { kind: "strip", left: labelLeft, top: rowTop }
        : toTreeRailPlacement({
            cards: toTreeRailRowCards({ cards, rowStep: TREE_LAYOUT.rowStep, rowY: row.y }),
            labelWidth: labelWidths.widths.get(row.row) ?? GENERATION_RAIL.fallbackLabelWidth,
            left: labelLeft,
            rowStep: TREE_LAYOUT.rowStep,
            rowY: row.y,
            transform,
          });
    return [
      {
        caption: isGenealogy ? "" : labels.generationCaption(row.generation),
        placement,
        row: row.row,
        rowTop,
        title: isGenealogy
          ? labels.ordinalGeneration(row.generation)
          : labels.generation(row.generation),
      },
    ];
  });

  return (
    <>
      <ViewportPortal>
        <div aria-hidden className="pointer-events-none">
          {confirmed.map((row) => (
            <div
              className="absolute -z-10 rounded-3xl bg-secondary/40 dark:bg-secondary/25"
              key={row.row}
              style={{ height, left, top: row.y - height / 2, width }}
            />
          ))}
        </div>
      </ViewportPortal>
      {showLabels ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
          {railRows.map((rail) => (
            <RailLabel
              isChipOnly={step > 1}
              key={rail.row}
              labelLeft={labelLeft}
              measureRef={(element) => labelWidths.register(rail.row, element)}
              rail={rail}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function RailLabel({
  isChipOnly,
  labelLeft,
  measureRef,
  rail,
}: {
  isChipOnly: boolean;
  labelLeft: number;
  measureRef: (element: Nullable<HTMLDivElement>) => void;
  rail: RailRow;
}) {
  const { caption, placement, rowTop, title } = rail;
  const chip =
    placement.kind === "strip" ? (
      <div
        className={cn(RAIL_LABEL_STYLES.base, RAIL_LABEL_STYLES.chip)}
        style={{ left: placement.left, top: placement.top }}
      >
        <span className={RAIL_LABEL_STYLES.chipTitle}>{title}</span>
      </div>
    ) : null;
  if (isChipOnly) return chip;

  return (
    <>
      <div
        className={cn(
          RAIL_LABEL_STYLES.base,
          RAIL_LABEL_STYLES.row,
          placement.kind === "row" ? null : "invisible",
        )}
        ref={measureRef}
        style={{ left: placement.kind === "row" ? placement.left : labelLeft, top: rowTop }}
      >
        <span className={RAIL_LABEL_STYLES.rowTitle}>{title}</span>
        {caption.length === 0 ? null : (
          <span className="text-xs leading-tight text-muted-foreground">{caption}</span>
        )}
      </div>
      {chip}
    </>
  );
}

function sameWidths(
  current: ReadonlyMap<number, number>,
  next: ReadonlyMap<number, number>,
): boolean {
  if (current.size !== next.size) return false;
  return [...next].every(([row, width]) => current.get(row) === width);
}

function toCards(key: string): TreeRailCard[] {
  if (key.length === 0) return [];
  return key.split(";").flatMap((entry): TreeRailCard[] => {
    const [x, y, width, height] = entry.split(",").map(Number);
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      return [];
    }
    return [{ height, width, x, y }];
  });
}

function useRailLabelWidths(): {
  register: (row: number, element: Nullable<HTMLDivElement>) => void;
  widths: ReadonlyMap<number, number>;
} {
  const elementsRef = useRef(new Map<number, HTMLDivElement>());
  const observerRef = useRef<Nullable<ResizeObserver>>(null);
  const [widths, setWidths] = useState<ReadonlyMap<number, number>>(() => new Map());

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const next = new Map(
        [...elementsRef.current].map(([row, element]) => [row, element.offsetWidth] as const),
      );
      setWidths((current) => (sameWidths(current, next) ? current : next));
    });
    observerRef.current = observer;
    for (const element of elementsRef.current.values()) observer.observe(element);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  function register(row: number, element: Nullable<HTMLDivElement>) {
    const previous = elementsRef.current.get(row);
    if (previous === element) return;
    if (previous !== undefined) observerRef.current?.unobserve(previous);
    if (element === null) {
      elementsRef.current.delete(row);
      return;
    }
    elementsRef.current.set(row, element);
    observerRef.current?.observe(element);
  }

  return { register, widths };
}

"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { TreePairStyle } from "../../model/workspace/graph-tree-pairs";
import type { TreeOptions } from "../../model/workspace/graph-tree-scene";

import { GRAPH_TREE_LINEAGE_DASH, GRAPH_TREE_TONES } from "./graph-tree-tones";

const LEGEND_LINES = [
  { dash: GRAPH_TREE_LINEAGE_DASH.biological, key: "biological", style: "lineage" },
  { dash: GRAPH_TREE_LINEAGE_DASH.adoptive, key: "adoptive", style: "lineage" },
  { dash: GRAPH_TREE_LINEAGE_DASH.step, key: "step", style: "lineage" },
  { dash: GRAPH_TREE_TONES.marriages.dash, key: "marriages", style: "marriages" },
  { dash: GRAPH_TREE_TONES.exUnions.dash, key: "exUnions", style: "exUnions" },
  { dash: GRAPH_TREE_TONES.siblings.dash, key: "siblings", style: "siblings" },
  { dash: GRAPH_TREE_TONES.guardians.dash, key: "guardians", style: "guardians" },
  { dash: GRAPH_TREE_TONES.distant.dash, key: "distant", style: "distant" },
  { dash: GRAPH_TREE_TONES.conflict.dash, key: "conflict", style: "conflict" },
] as const satisfies readonly { dash: string | undefined; key: string; style: TreePairStyle }[];

type GraphTreeLegendProps = {
  options: TreeOptions;
};

export function GraphTreeLegend({ options }: GraphTreeLegendProps) {
  const t = useTranslations("relationships.workspace.tree.legend");
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <Collapsible
      className="shrink-0 border-t border-border bg-card/80 px-3 py-1"
      onOpenChange={setOpen}
      open={open}
    >
      <div className="flex min-h-10 items-center gap-3">
        <p className="shrink-0 text-xs font-semibold text-muted-foreground" id={titleId}>
          {t("title")}
        </p>
        {open ? null : (
          <LegendList
            className="hidden h-4 min-w-0 flex-1 overflow-hidden sm:flex"
            options={options}
            preview
          />
        )}
        <CollapsibleTrigger asChild>
          <Button
            aria-describedby={titleId}
            className="group/legend ml-auto shrink-0 text-muted-foreground"
            size="sm"
            type="button"
            variant="ghost"
          >
            {t(open ? "collapse" : "expand")}
            <ChevronDown
              aria-hidden
              className="transition-transform group-data-[state=open]/legend:rotate-180 motion-reduce:transition-none"
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="flex flex-col gap-2 pb-2">
        <LegendList className="flex" options={options} preview={false} />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="h-4 w-7 shrink-0 rounded-full border border-dashed border-muted-foreground/60"
          />
          {t("side")}
        </p>
        <p className="text-xs text-muted-foreground">{t("caption")}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LegendList({
  className,
  options,
  preview,
}: {
  className: string;
  options: TreeOptions;
  preview: boolean;
}) {
  const t = useTranslations("relationships.workspace.tree.legend");

  return (
    <ul
      aria-hidden={preview || undefined}
      aria-label={preview ? undefined : t("title")}
      className={cn("flex-wrap gap-x-4 gap-y-1.5", className)}
    >
      {LEGEND_LINES.map((line) => {
        const tone = GRAPH_TREE_TONES[line.style];
        const Icon = tone.icon;
        const isOff = line.style !== "lineage" && line.style !== "conflict" && !options[line.style];
        return (
          <li className="flex items-center gap-1.5 text-xs text-foreground" key={line.key}>
            <svg
              aria-hidden
              className={cn("h-2 w-7 shrink-0 overflow-visible", isOff && "opacity-40")}
              viewBox="0 0 28 8"
            >
              <line
                className={tone.line}
                strokeDasharray={line.dash}
                strokeLinecap="round"
                strokeWidth={2}
                x1={1}
                x2={27}
                y1={4}
                y2={4}
              />
            </svg>
            <Icon
              aria-hidden
              className={cn("size-3.5 shrink-0", tone.iconColor, isOff && "opacity-40")}
            />
            <span className={cn(isOff && "text-muted-foreground line-through")}>
              {t(`items.${line.key}`)}
            </span>
            {isOff ? <span className="sr-only">{t("off")}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

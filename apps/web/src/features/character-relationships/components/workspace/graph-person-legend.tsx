"use client";

import type { RelationshipCategory } from "@app/shared";

import { RelationshipCategorySchema } from "@app/shared";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { GraphPairTone } from "../../model/workspace/graph-person-semantics";

import { useRelationshipLabels } from "../../model/use-relationship-labels";
import { GRAPH_PERSON_TONES } from "./graph-person-tones";

const NEUTRAL_TONES = ["mixed", "masked"] as const satisfies readonly GraphPairTone[];

type GraphPersonLegendProps = {
  activeCategories: readonly RelationshipCategory[];
};

export function GraphPersonLegend({ activeCategories }: GraphPersonLegendProps) {
  const t = useTranslations("relationships.workspace.legend");
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
            activeCategories={activeCategories}
            className="hidden h-4 min-w-0 flex-1 overflow-hidden sm:flex"
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
      <CollapsibleContent className="pb-2">
        <LegendList activeCategories={activeCategories} className="flex" preview={false} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function LegendItem({
  excluded,
  excludedLabel,
  label,
  tone,
}: {
  excluded: boolean;
  excludedLabel: string;
  label: string;
  tone: GraphPairTone;
}) {
  const style = GRAPH_PERSON_TONES[tone];
  const Icon = style.icon;

  return (
    <li className="flex items-center gap-1.5 text-xs text-foreground">
      <svg
        aria-hidden
        className={cn("h-2 w-7 shrink-0 overflow-visible", excluded && "opacity-40")}
        viewBox="0 0 28 8"
      >
        <line
          className={style.line}
          strokeDasharray={style.dash}
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
        className={cn("size-3.5 shrink-0", style.iconColor, excluded && "opacity-40")}
      />
      <span className={cn(excluded && "text-muted-foreground line-through")}>{label}</span>
      {excluded ? <span className="sr-only">{excludedLabel}</span> : null}
    </li>
  );
}

function LegendList({
  activeCategories,
  className,
  preview,
}: {
  activeCategories: readonly RelationshipCategory[];
  className: string;
  preview: boolean;
}) {
  const t = useTranslations("relationships.workspace.legend");
  const labels = useRelationshipLabels();
  const isFiltered = activeCategories.length > 0;

  return (
    <ul
      aria-hidden={preview || undefined}
      aria-label={preview ? undefined : t("title")}
      className={cn("flex-wrap gap-x-4 gap-y-1.5", className)}
    >
      {RelationshipCategorySchema.options.map((category) => {
        const isExcluded = isFiltered && !activeCategories.includes(category);
        return (
          <LegendItem
            excluded={isExcluded}
            excludedLabel={t("filteredOut")}
            key={category}
            label={labels.category(category)}
            tone={category}
          />
        );
      })}
      {NEUTRAL_TONES.map((tone) => (
        <LegendItem excluded={false} excludedLabel="" key={tone} label={t(tone)} tone={tone} />
      ))}
    </ul>
  );
}

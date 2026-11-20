"use client";

import type { RelationshipCategory } from "@app/shared";

import { RelationshipCategorySchema } from "@app/shared";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import type { GraphPairTone } from "../../model/workspace/graph-person-semantics";

import { useRelationshipLabels } from "../../model/use-relationship-labels";
import { GRAPH_PERSON_TONES } from "./graph-person-tones";

const NEUTRAL_TONES = ["mixed", "masked"] as const satisfies readonly GraphPairTone[];

type GraphPersonLegendProps = {
  activeCategories: readonly RelationshipCategory[];
  collapsible: boolean;
};

export function GraphPersonLegend({ activeCategories, collapsible }: GraphPersonLegendProps) {
  const t = useTranslations("relationships.workspace.legend");

  if (collapsible) {
    return (
      <Collapsible className="border-t border-border bg-card/80 px-3 py-1.5">
        <CollapsibleTrigger className="group/legend flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {t("title")}
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform group-data-[state=open]/legend:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pb-2">
          <LegendList activeCategories={activeCategories} />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-card/80 px-3 py-2.5">
      <p aria-hidden className="text-xs font-semibold text-muted-foreground">
        {t("title")}
      </p>
      <LegendList activeCategories={activeCategories} />
    </div>
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

function LegendList({ activeCategories }: { activeCategories: readonly RelationshipCategory[] }) {
  const t = useTranslations("relationships.workspace.legend");
  const labels = useRelationshipLabels();
  const isFiltered = activeCategories.length > 0;

  return (
    <ul aria-label={t("title")} className="flex flex-wrap gap-x-4 gap-y-1.5">
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

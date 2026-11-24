"use client";

import type { CharacterGraphNodeView, RelationshipCategory } from "@app/shared";

import { ArrowLeftRight, ChevronRight, EyeOff, Telescope, Users, Waypoints } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import { useRelationshipLabels } from "../../model/use-relationship-labels";
import { GraphNetworkPanelList } from "./graph-network-panel-list";
import { GraphNetworkStatTile } from "./graph-network-stat-tile";
import { GraphPersonRelationChip } from "./graph-person-relation-chip";
import { GRAPH_PERSON_TONES } from "./graph-person-tones";
import { useGraphPairLabel } from "./use-graph-pair-label";

export type GraphNetworkAggregateCategory = {
  category: RelationshipCategory;
  count: number;
};

export type GraphNetworkAggregateExplore = {
  label: string;
  onExplore: () => void;
};

export type GraphNetworkAggregatePair = {
  connectionId: string;
  first: CharacterGraphNodeView;
  second: CharacterGraphNodeView;
  semantics: GraphPairSemantics;
};

type GraphNetworkAggregateDetailsProps = {
  categories: readonly GraphNetworkAggregateCategory[];
  edgeCount: number;
  explore: readonly GraphNetworkAggregateExplore[];
  hasMaskedDetails: boolean;
  onOpenConnection: (connectionId: string) => void;
  pairCount: number;
  pairs: readonly GraphNetworkAggregatePair[];
  sourceLabel: string;
  targetLabel: string;
};

export function GraphNetworkAggregateDetails({
  categories,
  edgeCount,
  explore,
  hasMaskedDetails,
  onOpenConnection,
  pairCount,
  pairs,
  sourceLabel,
  targetLabel,
}: GraphNetworkAggregateDetailsProps) {
  const t = useTranslations("relationships.workspace.networkPanel.aggregate");
  const labels = useRelationshipLabels();
  const toLabel = useGraphPairLabel();
  const categoriesId = useId();
  const hasBreakdown = categories.length > 0 || hasMaskedDetails;

  return (
    <>
      <h3 className="min-w-0 font-heading text-lg leading-tight font-semibold break-words text-ink">
        <span className="sr-only">{t("title", { source: sourceLabel, target: targetLabel })}</span>
        <span aria-hidden className="flex min-w-0 flex-col gap-0.5">
          <TruncatedText lines={2} text={sourceLabel} />
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <TruncatedText lines={2} text={targetLabel} />
        </span>
      </h3>
      <section aria-label={t("stats.label")}>
        <dl className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border bg-muted/40 py-2">
          <GraphNetworkStatTile
            count={edgeCount}
            icon={Waypoints}
            label={t("stats.relations", { count: edgeCount })}
          />
          <GraphNetworkStatTile
            count={pairCount}
            icon={Users}
            label={t("stats.pairs", { count: pairCount })}
          />
        </dl>
      </section>
      {explore.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          {explore.map((action, index) => (
            <Button className="w-full" key={index} onClick={action.onExplore} type="button">
              <Telescope aria-hidden />
              <TruncatedText text={t("explore", { group: action.label })} />
            </Button>
          ))}
        </div>
      )}
      {hasBreakdown ? (
        <section aria-labelledby={categoriesId} className="flex flex-col gap-2">
          <h3 className="font-heading text-base font-semibold text-ink" id={categoriesId}>
            {t("categories.title")}
          </h3>
          {categories.length === 0 ? null : (
            <ul className="flex flex-col gap-1.5">
              {categories.map(({ category, count }) => {
                const tone = GRAPH_PERSON_TONES[category];
                const Icon = tone.icon;
                return (
                  <li className="flex min-w-0 items-center gap-2 text-sm" key={category}>
                    <Icon aria-hidden className={cn("size-4 shrink-0", tone.iconColor)} />
                    <span className="min-w-0 flex-1 truncate">{labels.category(category)}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("categories.count", { count })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {hasMaskedDetails ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <EyeOff aria-hidden className="size-4 shrink-0" />
              {t("masked")}
            </p>
          ) : null}
        </section>
      ) : null}
      <GraphNetworkPanelList
        emptyText={t("pairs.empty")}
        items={pairs}
        keyOf={(item) => item.connectionId}
        namesOf={(item) => [
          item.first.displayName,
          item.first.name,
          item.second.displayName,
          item.second.name,
        ]}
        renderItem={(item) => {
          const names = t("pairs.names", {
            first: item.first.displayName,
            second: item.second.displayName,
          });
          return (
            <button
              aria-label={t("pairs.open", { label: toLabel(item.semantics), names })}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              onClick={() => onOpenConnection(item.connectionId)}
              type="button"
            >
              <span aria-hidden className="flex shrink-0 -space-x-2">
                <PairAvatar node={item.first} />
                <PairAvatar node={item.second} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <TruncatedText className="text-sm font-medium break-words" lines={2} text={names} />
                <GraphPersonRelationChip className="self-start" semantics={item.semantics} />
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        }}
        title={t("pairs.title")}
      />
    </>
  );
}

function PairAvatar({ node }: { node: CharacterGraphNodeView }) {
  return (
    <Avatar className="border-2 border-card" size="sm">
      {node.displayMedia === null ? null : (
        <AvatarImage alt="" src={node.displayMedia.urls.thumb} />
      )}
      <AvatarFallback>{node.displayName.trim().charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

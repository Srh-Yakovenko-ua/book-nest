"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { BOOK_CHARACTER_UNSPECIFIED } from "@app/shared";
import {
  ChevronRight,
  Crosshair,
  MapPinned,
  MapPinOff,
  Orbit,
  Route,
  UserRound,
  Users,
  Waypoints,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCharacterDetailsPath } from "@/features/characters";
import { Link } from "@/i18n/navigation";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";

import { GraphNetworkPanelList } from "./graph-network-panel-list";
import { GraphNetworkStatTile } from "./graph-network-stat-tile";
import { GraphPersonRelationChip } from "./graph-person-relation-chip";
import { useGraphPairLabel } from "./use-graph-pair-label";

export type GraphNetworkCharacterConnection = {
  connectionId: string;
  isOnMap: boolean;
  other: CharacterGraphNodeView;
  otherGroupLabel: Nullable<string>;
  semantics: GraphPairSemantics;
};

export type GraphNetworkCharacterCounts = {
  pairsAvailable: number;
  pairsOnMap: number;
  relationsAvailable: number;
};

type GraphNetworkCharacterDetailsProps = {
  bookId: string;
  connections: readonly GraphNetworkCharacterConnection[];
  counts: GraphNetworkCharacterCounts;
  groupLabel: Nullable<string>;
  node: CharacterGraphNodeView;
  onExploreAround: () => void;
  onFindPath: () => void;
  onFocusOnMap: Nullable<() => void>;
  onOpenConnection: (connectionId: string) => void;
};

export function GraphNetworkCharacterDetails({
  bookId,
  connections,
  counts,
  groupLabel,
  node,
  onExploreAround,
  onFindPath,
  onFocusOnMap,
  onOpenConnection,
}: GraphNetworkCharacterDetailsProps) {
  const t = useTranslations("relationships.workspace.networkPanel.character");
  const tPanel = useTranslations("relationships.workspace.panel");
  const tImportance = useTranslations("characters.importance");
  const toLabel = useGraphPairLabel();

  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-14 shrink-0 border-2 border-card ring-1 ring-border">
          {node.displayMedia === null ? null : (
            <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.card} />
          )}
          <AvatarFallback className="font-heading text-2xl">
            {node.displayName.trim().charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="flex min-w-0">
            <TruncatedText
              className="font-heading text-xl leading-tight font-semibold break-words text-ink"
              lines={2}
              text={node.displayName}
            />
          </h3>
          <div className="flex min-w-0 flex-wrap gap-1">
            {groupLabel === null ? null : (
              <Badge className="max-w-full" variant="primary">
                <Users aria-hidden className="size-3" />
                <span aria-hidden className="flex min-w-0">
                  <TruncatedText text={groupLabel} />
                </span>
                <span className="sr-only">{t("group", { name: groupLabel })}</span>
              </Badge>
            )}
            {node.importance === null ||
            node.importance === BOOK_CHARACTER_UNSPECIFIED.importance ? null : (
              <Badge variant="outline">
                {tPanel("person.importance", { label: tImportance(node.importance) })}
              </Badge>
            )}
            {node.isFavorite ? (
              <Badge variant="outline">
                <UiIcon className="text-favorite" name="heart-fill" size={12} />
                {tPanel("character.favorite")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      <section aria-label={t("stats.label")} className="flex flex-col gap-1.5">
        <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/40 py-2">
          <GraphNetworkStatTile
            count={counts.pairsOnMap}
            icon={MapPinned}
            label={t("stats.pairsOnMap", { count: counts.pairsOnMap })}
          />
          <GraphNetworkStatTile
            count={counts.pairsAvailable}
            icon={Users}
            label={t("stats.pairsAvailable", { count: counts.pairsAvailable })}
          />
          <GraphNetworkStatTile
            count={counts.relationsAvailable}
            icon={Waypoints}
            label={t("stats.relationsAvailable", { count: counts.relationsAvailable })}
          />
        </dl>
        <p className="text-xs text-muted-foreground">{t("stats.caption")}</p>
      </section>
      <div className="flex flex-wrap gap-2">
        {onFocusOnMap === null ? null : (
          <Button className="w-full" onClick={onFocusOnMap} type="button">
            <Crosshair aria-hidden />
            {t("actions.focus")}
          </Button>
        )}
        <Button
          className="min-w-0 grow"
          onClick={onExploreAround}
          type="button"
          variant={onFocusOnMap === null ? "default" : "outline"}
        >
          <Orbit aria-hidden />
          {t("actions.around")}
        </Button>
        <Button className="min-w-0 grow" onClick={onFindPath} type="button" variant="outline">
          <Route aria-hidden />
          {t("actions.path")}
        </Button>
        <Button asChild className="min-w-0 grow" variant="outline">
          <Link href={getCharacterDetailsPath({ bookId, characterId: node.id })}>
            <UserRound aria-hidden />
            {t("actions.profile")}
          </Link>
        </Button>
      </div>
      <GraphNetworkPanelList
        emptyText={t("pairs.empty")}
        items={connections}
        keyOf={(item) => item.connectionId}
        namesOf={(item) => [item.other.displayName, item.other.name]}
        renderItem={(item) => (
          <button
            aria-label={t(item.isOnMap ? "pairs.open" : "pairs.openOffMap", {
              label: toLabel(item.semantics),
              name:
                item.otherGroupLabel === null
                  ? item.other.displayName
                  : t("pairs.nameInGroup", {
                      group: item.otherGroupLabel,
                      name: item.other.displayName,
                    }),
            })}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            onClick={() => onOpenConnection(item.connectionId)}
            type="button"
          >
            <Avatar size="sm">
              {item.other.displayMedia === null ? null : (
                <AvatarImage alt="" src={item.other.displayMedia.urls.thumb} />
              )}
              <AvatarFallback>
                {item.other.displayName.trim().charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <TruncatedText className="text-sm font-medium" text={item.other.displayName} />
              {item.otherGroupLabel === null ? null : (
                <span className="truncate text-xs text-muted-foreground">
                  {item.otherGroupLabel}
                </span>
              )}
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <GraphPersonRelationChip semantics={item.semantics} />
                {item.isOnMap ? null : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPinOff aria-hidden className="size-3.5 shrink-0" />
                    {t("pairs.offMap")}
                  </span>
                )}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
        title={t("pairs.title")}
      />
    </>
  );
}

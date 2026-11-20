"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";
import type { LucideIcon } from "lucide-react";

import { ChevronRight, Crown, Route, UserRound, Users, Waypoints } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCharacterDetailsPath } from "@/features/characters";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type {
  GraphCharacterReach,
  GraphPairSemantics,
} from "../../model/workspace/graph-person-semantics";

import { GraphPersonRelationChip } from "./graph-person-relation-chip";
import { useGraphPairLabel } from "./use-graph-pair-label";

const PERSON_DETAILS = {
  nearestPreview: 3,
} as const;

export type GraphPersonNearestItem = {
  connectionId: string;
  other: CharacterGraphNodeView;
  semantics: GraphPairSemantics;
};

type GraphPersonCharacterDetailsProps = {
  bookId: string;
  branch: Nullable<{ expanded: boolean; onToggle: () => void }>;
  isPartial: boolean;
  isRoot: boolean;
  mapCharacters: number;
  nearest: readonly GraphPersonNearestItem[];
  node: CharacterGraphNodeView;
  onFindPath: () => void;
  onMakeCenter: Nullable<() => void>;
  onOpenConnection: (connectionId: string) => void;
  reach: GraphCharacterReach;
};

export function GraphPersonCharacterDetails({
  bookId,
  branch,
  isPartial,
  isRoot,
  mapCharacters,
  nearest,
  node,
  onFindPath,
  onMakeCenter,
  onOpenConnection,
  reach,
}: GraphPersonCharacterDetailsProps) {
  const t = useTranslations("relationships.workspace.panel.character");
  const tPerson = useTranslations("relationships.workspace.panel.person");
  const tImportance = useTranslations("characters.importance");
  const nearestId = useId();
  const listId = useId();
  const [showAll, setShowAll] = useState(false);
  const toLabel = useGraphPairLabel();
  const visible = showAll ? nearest : nearest.slice(0, PERSON_DETAILS.nearestPreview);
  const canExpand = nearest.length > PERSON_DETAILS.nearestPreview;

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar
          className={cn(
            "size-16 shrink-0 border-2 border-card sm:size-18",
            isRoot ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border",
          )}
        >
          {node.displayMedia === null ? null : (
            <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.card} />
          )}
          <AvatarFallback className="font-heading text-2xl">
            {node.displayName.trim().charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="flex min-w-0">
            <TruncatedText
              className="font-heading text-xl leading-tight font-semibold break-words text-ink"
              lines={2}
              text={node.displayName}
            />
          </h3>
          <div className="flex flex-wrap gap-1">
            {isRoot ? (
              <Badge variant="primary">
                <Crown aria-hidden className="size-3" />
                {tPerson("root")}
              </Badge>
            ) : null}
            {node.importance === null || node.importance === "not_specified" ? null : (
              <Badge variant="outline">
                {tPerson("importance", { label: tImportance(node.importance) })}
              </Badge>
            )}
            {node.isFavorite ? (
              <Badge variant="outline">
                <UiIcon className="text-favorite" name="heart-fill" size={12} />
                {t("favorite")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      <section aria-label={tPerson("stats.label")} className="flex flex-col gap-1.5">
        <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/40 py-2">
          <StatTile
            count={reach.neighbors}
            icon={Users}
            label={tPerson("stats.neighbors", { count: reach.neighbors })}
          />
          <StatTile
            count={reach.relationships}
            icon={Waypoints}
            label={tPerson("stats.relationships", { count: reach.relationships })}
          />
          <StatTile
            count={mapCharacters}
            icon={UserRound}
            label={tPerson("stats.characters", { count: mapCharacters })}
          />
        </dl>
        <p className="text-xs text-muted-foreground">
          {tPerson(isPartial ? "stats.partial" : "stats.caption")}
        </p>
      </section>
      <div className="flex flex-col gap-2">
        {onMakeCenter === null ? null : (
          <Button className="w-full" onClick={onMakeCenter} type="button">
            <Crown aria-hidden />
            {tPerson("makeCenter")}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="w-full"
            onClick={onFindPath}
            type="button"
            variant={onMakeCenter === null ? "default" : "outline"}
          >
            <Route aria-hidden />
            {tPerson("findPath")}
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href={getCharacterDetailsPath({ bookId, characterId: node.id })}>
              <UserRound aria-hidden />
              {tPerson("profile")}
            </Link>
          </Button>
        </div>
        {branch === null ? null : (
          <Button className="w-full" onClick={branch.onToggle} type="button" variant="ghost">
            <UiIcon name={branch.expanded ? "minus" : "plus"} size={14} />
            {t(branch.expanded ? "collapse" : "expand")}
          </Button>
        )}
      </div>
      <section aria-labelledby={nearestId} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-base font-semibold text-ink" id={nearestId}>
            {tPerson("nearest")}
          </h3>
          {canExpand ? (
            <Button
              aria-controls={listId}
              aria-expanded={showAll}
              onClick={() => setShowAll((current) => !current)}
              size="sm"
              type="button"
              variant="link"
            >
              {showAll ? tPerson("nearestLess") : tPerson("nearestAll", { count: nearest.length })}
            </Button>
          ) : null}
        </div>
        {nearest.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noConnections")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" id={listId}>
            {visible.map((item) => (
              <li key={item.connectionId}>
                <button
                  aria-label={tPerson("openPair", {
                    label: toLabel(item.semantics),
                    name: item.other.displayName,
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
                    <span className="truncate text-sm font-medium">{item.other.displayName}</span>
                    <GraphPersonRelationChip className="self-start" semantics={item.semantics} />
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StatTile({
  count,
  icon: Icon,
  label,
}: {
  count: number;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex flex-col-reverse items-center gap-0.5 px-1 text-center">
      <dt className="text-xs leading-tight text-muted-foreground">{label}</dt>
      <dd className="flex flex-col items-center gap-1 font-heading text-lg leading-none font-semibold text-ink tabular-nums">
        <Icon aria-hidden className="size-4 text-icon" />
        {count}
      </dd>
    </div>
  );
}

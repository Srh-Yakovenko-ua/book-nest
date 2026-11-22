"use client";

import type { CharacterGraphNodeView, Nullable } from "@app/shared";
import type { LucideIcon } from "lucide-react";

import { ChevronRight, Crown, GitMerge, UserRound, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TreeRelative } from "../../model/workspace/graph-tree-relatives";

import { useGraphTreeLabels } from "./use-graph-tree-labels";

const TREE_DETAILS = {
  relativesPreview: 3,
} as const;

type GraphTreeCharacterDetailsProps = {
  anchorName: Nullable<string>;
  generation: Nullable<number>;
  isRoot: boolean;
  node: CharacterGraphNodeView;
  nodeOf: (id: string) => CharacterGraphNodeView | undefined;
  onOpenConnection: (connectionId: string) => void;
  relatives: readonly TreeRelative[];
  treeCharacters: number;
};

export function GraphTreeCharacterDetails({
  anchorName,
  generation,
  isRoot,
  node,
  nodeOf,
  onOpenConnection,
  relatives,
  treeCharacters,
}: GraphTreeCharacterDetailsProps) {
  const t = useTranslations("relationships.workspace.tree.panel");
  const labels = useGraphTreeLabels();
  const relativesId = useId();
  const listId = useId();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? relatives : relatives.slice(0, TREE_DETAILS.relativesPreview);
  const canExpand = relatives.length > TREE_DETAILS.relativesPreview;
  const relationships = relatives.reduce((sum, relative) => sum + relative.entries.length, 0);

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar
          className={cn(
            "size-14 shrink-0 border-2 border-card",
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
                {t("root")}
              </Badge>
            ) : null}
            <Badge variant="outline">
              {generation === null ? t("generationUnconfirmed") : labels.generation(generation)}
            </Badge>
            {node.isFavorite ? (
              <Badge variant="outline">
                <UiIcon className="text-favorite" name="heart-fill" size={12} />
                {t("favorite")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      {generation === null && anchorName !== null ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {t("sideHint", { name: anchorName })}
        </p>
      ) : null}
      <dl
        aria-label={t("stats.label")}
        className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/40 py-2"
      >
        <StatTile
          count={relatives.length}
          icon={Users}
          label={t("stats.relatives", { count: relatives.length })}
        />
        <StatTile
          count={relationships}
          icon={GitMerge}
          label={t("stats.relationships", { count: relationships })}
        />
        <StatTile
          count={treeCharacters}
          icon={UserRound}
          label={t("stats.characters", { count: treeCharacters })}
        />
      </dl>
      <section aria-labelledby={relativesId} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-base font-semibold text-ink" id={relativesId}>
            {t("relatives")}
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
              {showAll ? t("relativesLess") : t("relativesAll", { count: relatives.length })}
            </Button>
          ) : null}
        </div>
        {relatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRelatives")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" id={listId}>
            {visible.map((relative) => {
              const other = nodeOf(relative.otherId);
              if (other === undefined) return null;
              const role = relative.entries
                .map((entry) => labels.role({ entry, perspectiveId: node.id }))
                .join(" · ");
              return (
                <li key={relative.connectionId}>
                  <button
                    aria-label={t("openRelative", { label: role, name: other.displayName })}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
                    onClick={() => onOpenConnection(relative.connectionId)}
                    type="button"
                  >
                    <Avatar size="sm">
                      {other.displayMedia === null ? null : (
                        <AvatarImage alt="" src={other.displayMedia.urls.thumb} />
                      )}
                      <AvatarFallback>
                        {other.displayName.trim().charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{other.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{role}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
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

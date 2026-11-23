"use client";

import type { CharacterGraphEdgeView, CharacterGraphNodeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { TruncatedText } from "@/components/truncated-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { TreePairSemantics } from "../../model/workspace/graph-tree-pairs";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";

import { toTreeEntryStyle } from "../../model/workspace/graph-tree-pairs";
import { GraphConnectionDetails } from "./graph-connection-details";
import { GRAPH_TREE_TONES } from "./graph-tree-tones";
import { useGraphTreeLabels } from "./use-graph-tree-labels";

type GraphTreePairDetailsProps = {
  actions: RelationshipActions;
  bookId: string;
  first: CharacterGraphNodeView;
  pair: TreePairSemantics;
  reader: GraphReaderKey;
  second: CharacterGraphNodeView;
};

export function GraphTreePairDetails({
  actions,
  bookId,
  first,
  pair,
  reader,
  second,
}: GraphTreePairDetailsProps) {
  const t = useTranslations("relationships.workspace.tree.panel");
  const tPanel = useTranslations("relationships.workspace.panel");
  const labels = useGraphTreeLabels();
  const nameOf = (id: string) => (id === first.id ? first.displayName : second.displayName);
  const entryById = new Map(pair.entries.map((entry) => [entry.edge.id, entry] as const));
  const edges = pair.entries.map((entry): CharacterGraphEdgeView => entry.edge);
  const hasConflict = pair.entries.some((entry) => entry.kind === "conflict");

  function toDirectionText(edge: CharacterGraphEdgeView): string {
    if (edge.directionality === null) return tPanel("person.direction.unknown");
    if (edge.directionality === "symmetric") return tPanel("person.direction.symmetric");
    return tPanel("person.direction.directed", {
      source: nameOf(edge.source),
      target: nameOf(edge.target),
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h3 className="sr-only">
          {tPanel("connection.title", { source: first.displayName, target: second.displayName })}
        </h3>
        <div aria-hidden className="flex items-start gap-2">
          <PairParticipant node={first} />
          <PairParticipant node={second} />
        </div>
        <ul className="flex flex-wrap justify-center gap-1">
          {pair.styles.map((style) => {
            const tone = GRAPH_TREE_TONES[style];
            const Icon = tone.icon;
            return (
              <li
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  tone.badge,
                )}
                key={style}
              >
                <Icon aria-hidden className={cn("size-3.5", tone.iconColor)} />
                {labels.style(style)}
              </li>
            );
          })}
        </ul>
        {pair.relationshipCount > 1 ? (
          <p className="text-center text-xs text-muted-foreground">
            {t("pairCount", { count: pair.relationshipCount })}
          </p>
        ) : null}
        {hasConflict ? (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {t("conflictHint")}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 grow flex-col gap-4">
        <GraphConnectionDetails
          actions={actions}
          contentKey={JSON.stringify([bookId, reader, pair.connectionId])}
          edges={edges}
          key={pair.connectionId}
          layout="panel"
          names={{ source: first.displayName, target: second.displayName }}
          renderEdge={(edge, index) => {
            const entry = entryById.get(edge.id);
            if (entry === undefined) return null;
            const tone = GRAPH_TREE_TONES[toTreeEntryStyle(entry)];
            const Icon = tone.icon;
            return (
              <>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Icon aria-hidden className={cn("size-4 shrink-0", tone.iconColor)} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{labels.entry(entry)}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {entry.kind === "lineage"
                        ? t("lineageDirection", {
                            child: nameOf(entry.childId),
                            parent: nameOf(entry.parentId),
                          })
                        : toDirectionText(edge)}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tPanel("connection.item", { index: index + 1 })}
                </span>
              </>
            );
          }}
          scope={{ bookId, kind: "book" }}
        />
      </div>
    </>
  );
}

function PairParticipant({ node }: { node: CharacterGraphNodeView }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <Avatar className="size-12 border-2 border-card ring-1 ring-border">
        {node.displayMedia === null ? null : (
          <AvatarImage alt="" className="object-cover" src={node.displayMedia.urls.thumb} />
        )}
        <AvatarFallback className="font-heading text-base">
          {node.displayName.trim().charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <TruncatedText
        className="font-heading text-sm leading-tight font-semibold break-words text-ink"
        lines={2}
        text={node.displayName}
      />
    </span>
  );
}

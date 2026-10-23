"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import type { GraphConnection } from "../../model/workspace/graph-connections";
import type { NetworkAggregate } from "../../model/workspace/graph-network-scene";
import type {
  GraphPresentationCharacter,
  GraphPresentationCluster,
} from "../../model/workspace/graph-workspace-presentation";

import { useNetworkBucketLabel } from "./use-network-bucket-label";

type GraphConnectionsListProps = {
  aggregates: readonly NetworkAggregate[];
  characters: ReadonlyMap<string, GraphPresentationCharacter>;
  clusters: ReadonlyMap<string, GraphPresentationCluster>;
  connections: readonly GraphConnection[];
  onAggregateOpen: (sourceId: string, targetId: string) => void;
  onConnectionOpen: (connectionId: string) => void;
};

export function GraphConnectionsList({
  aggregates,
  characters,
  clusters,
  connections,
  onAggregateOpen,
  onConnectionOpen,
}: GraphConnectionsListProps) {
  const t = useTranslations("relationships.workspace.list");
  const toBucketLabel = useNetworkBucketLabel();
  const trigger = useRef<HTMLButtonElement>(null);
  const total = connections.length + aggregates.length;
  if (total === 0) return null;

  const nameOf = (id: string) => {
    const cluster = clusters.get(id);
    if (cluster !== undefined) return toBucketLabel(cluster.bucket.label);
    return characters.get(id)?.node.displayName ?? "";
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button className="self-start" ref={trigger} size="sm" type="button" variant="ghost">
          <UiIcon name="list" size={14} />
          {t("title", { count: total })}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="grid gap-1 pt-2 sm:grid-cols-2">
          {connections.map((connection) => (
            <li key={connection.id}>
              <Button
                className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                onClick={() => onConnectionOpen(connection.id)}
                type="button"
                variant="outline"
              >
                <span className="min-w-0 break-words">
                  {t("item", {
                    source: nameOf(connection.sourceId),
                    target: nameOf(connection.targetId),
                  })}
                </span>
              </Button>
            </li>
          ))}
          {aggregates.map((aggregate) => (
            <li key={aggregate.id}>
              <Button
                className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                onClick={() => {
                  onAggregateOpen(aggregate.sourceId, aggregate.targetId);
                  requestAnimationFrame(() => trigger.current?.focus());
                }}
                type="button"
                variant="outline"
              >
                <span className="min-w-0 break-words">
                  {t("aggregate", {
                    source: nameOf(aggregate.sourceId),
                    target: nameOf(aggregate.targetId),
                  })}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

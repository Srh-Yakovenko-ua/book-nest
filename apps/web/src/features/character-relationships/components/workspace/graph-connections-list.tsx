"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import type { GraphConnection } from "../../model/workspace/graph-connections";
import type { NetworkAggregateLink } from "../../model/workspace/graph-network-index";
import type {
  GraphPresentationCharacter,
  GraphPresentationCluster,
} from "../../model/workspace/graph-workspace-presentation";

import { useNetworkBucketLabel } from "./use-network-bucket-label";

const CONNECTIONS_LIST = {
  item: "h-auto w-full justify-start py-2 text-left whitespace-normal",
} as const;

type GraphConnectionsListProps = {
  aggregates: readonly NetworkAggregateLink[];
  characters: ReadonlyMap<string, GraphPresentationCharacter>;
  clusters: ReadonlyMap<string, GraphPresentationCluster>;
  connections: readonly GraphConnection[];
  onAggregateOpen: (aggregateId: string) => void;
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
  const t = useTranslations("relationships.workspace");
  const toBucketLabel = useNetworkBucketLabel();
  const total = connections.length + aggregates.length;
  if (total === 0) return null;

  const nameOf = (id: string): string => {
    const cluster = clusters.get(id);
    if (cluster !== undefined) return toBucketLabel(cluster.bucket.label);
    return characters.get(id)?.node.displayName ?? "";
  };

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button className="self-start" size="sm" type="button" variant="ghost">
          <UiIcon name="list" size={14} />
          {t("list.title", { count: total })}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="grid gap-1 pt-2 sm:grid-cols-2">
          {aggregates.map((aggregate) => (
            <li key={aggregate.id}>
              <Button
                className={CONNECTIONS_LIST.item}
                onClick={() => onAggregateOpen(aggregate.id)}
                type="button"
                variant="outline"
              >
                <span className="min-w-0 break-words">
                  {t("network.list.aggregate", {
                    pairs: aggregate.pairCount,
                    relations: aggregate.edgeCount,
                    source: nameOf(aggregate.sourceId),
                    target: nameOf(aggregate.targetId),
                  })}
                </span>
              </Button>
            </li>
          ))}
          {connections.map((connection) => (
            <li key={connection.id}>
              <Button
                className={CONNECTIONS_LIST.item}
                onClick={() => onConnectionOpen(connection.id)}
                type="button"
                variant="outline"
              >
                <span className="min-w-0 break-words">
                  {t("network.list.pair", {
                    relations: connection.edgeIds.length,
                    source: nameOf(connection.sourceId),
                    target: nameOf(connection.targetId),
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

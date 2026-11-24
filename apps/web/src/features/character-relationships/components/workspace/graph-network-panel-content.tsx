"use client";

import type { CharacterGraphEdgeView } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { NetworkBucket, NetworkIndex } from "../../model/workspace/graph-network-index";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type {
  GraphNetworkAggregateExplore,
  GraphNetworkAggregatePair,
} from "./graph-network-aggregate-details";
import type { GraphNetworkCharacterConnection } from "./graph-network-character-details";
import type { GraphNetworkGroupMember } from "./graph-network-group-members";
import type { GraphNetworkPanelTarget } from "./graph-network-panel-target";

import { summarizeNetworkLink } from "../../model/workspace/graph-network-scene";
import { toGraphPairSemantics } from "../../model/workspace/graph-person-semantics";
import { GraphConnectionDetails } from "./graph-connection-details";
import { GraphNetworkAggregateDetails } from "./graph-network-aggregate-details";
import { GraphNetworkCharacterDetails } from "./graph-network-character-details";
import { GraphNetworkGroupMembers } from "./graph-network-group-members";
import { GraphPersonEdgeRow } from "./graph-person-edge-row";
import { GraphPersonPairHeader } from "./graph-person-pair-header";

const PANEL_CONTENT = {
  nameLocale: "uk",
} as const;

export type GraphNetworkPanelContentProps = {
  bookId: string;
  index: NetworkIndex;
  isCharacterOnMap: (characterId: string) => boolean;
  isConnectionOnMap: (connectionId: string) => boolean;
  labelOf: (bucket: NetworkBucket) => string;
  onExplore: (target: { aggregateId: string; bucketId: string }) => void;
  onExploreAround: (characterId: string) => void;
  onFindPath: (characterId: string) => void;
  onFocusOnMap: (characterId: string) => void;
  onOpenConnection: (connectionId: string) => void;
  onPickCharacter: (characterId: string) => void;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
};

export function GraphNetworkPanelContent({
  target,
  ...props
}: GraphNetworkPanelContentProps & { target: GraphNetworkPanelTarget }) {
  switch (target.kind) {
    case "aggregate":
      return <AggregateContent {...props} key={target.link.id} target={target} />;
    case "character":
      return <CharacterContent {...props} key={target.node.id} target={target} />;
    case "connection":
      return <PairContent {...props} key={target.connection.id} target={target} />;
    case "members":
      return <MembersContent {...props} key={target.bucket.id} target={target} />;
    default:
      return assertNever(target);
  }
}

function AggregateContent({
  index,
  labelOf,
  onExplore,
  onOpenConnection,
  target,
}: GraphNetworkPanelContentProps & {
  target: Extract<GraphNetworkPanelTarget, { kind: "aggregate" }>;
}) {
  const { link } = target;
  const summary = summarizeNetworkLink({ index, link });
  const isSourceSide = (nodeId: string) =>
    nodeId === link.sourceId || index.bucketIdByNodeId.get(nodeId) === link.sourceId;
  const explore = [link.sourceId, link.targetId].flatMap(
    (bucketId): GraphNetworkAggregateExplore[] => {
      const bucket = index.bucketById.get(bucketId);
      if (bucket === undefined) return [];
      return [
        {
          label: labelOf(bucket),
          onExplore: () => onExplore({ aggregateId: link.id, bucketId: bucket.id }),
        },
      ];
    },
  );
  const pairs = link.connectionIds.flatMap((connectionId): GraphNetworkAggregatePair[] => {
    const connection = index.connectionById.get(connectionId);
    if (connection === undefined) return [];
    const [firstId, secondId] = isSourceSide(connection.sourceId)
      ? [connection.sourceId, connection.targetId]
      : [connection.targetId, connection.sourceId];
    const first = index.nodeById.get(firstId);
    const second = index.nodeById.get(secondId);
    if (first === undefined || second === undefined) return [];
    return [
      {
        connectionId,
        first,
        second,
        semantics: toGraphPairSemantics({ connection, edgeById: index.edgeById }),
      },
    ];
  });

  return (
    <GraphNetworkAggregateDetails
      categories={summary.categories}
      edgeCount={link.edgeCount}
      explore={explore}
      hasMaskedDetails={summary.hasMaskedDetails}
      onOpenConnection={onOpenConnection}
      pairCount={link.pairCount}
      pairs={pairs}
      sourceLabel={target.sourceLabel}
      targetLabel={target.targetLabel}
    />
  );
}

function CharacterContent({
  bookId,
  index,
  isCharacterOnMap,
  isConnectionOnMap,
  labelOf,
  onExploreAround,
  onFindPath,
  onFocusOnMap,
  onOpenConnection,
  target,
}: GraphNetworkPanelContentProps & {
  target: Extract<GraphNetworkPanelTarget, { kind: "character" }>;
}) {
  const { node } = target;
  const groupLabelOf = (nodeId: string) => {
    if (index.effectiveGrouping !== "group") return null;
    const bucketId = index.bucketIdByNodeId.get(nodeId);
    const bucket = bucketId === undefined ? undefined : index.bucketById.get(bucketId);
    if (bucket === undefined) return null;
    const { label } = bucket;
    if (label.kind !== "group" || label.name === null) return null;
    return labelOf(bucket);
  };
  const connections = (index.connectionIdsByNodeId.get(node.id) ?? [])
    .flatMap((connectionId): GraphNetworkCharacterConnection[] => {
      const connection = index.connectionById.get(connectionId);
      if (connection === undefined) return [];
      const otherId = connection.sourceId === node.id ? connection.targetId : connection.sourceId;
      const other = index.nodeById.get(otherId);
      if (other === undefined) return [];
      return [
        {
          connectionId,
          isOnMap: isConnectionOnMap(connectionId),
          other,
          otherGroupLabel: groupLabelOf(otherId),
          semantics: toGraphPairSemantics({ connection, edgeById: index.edgeById }),
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(right.isOnMap) - Number(left.isOnMap) ||
        right.semantics.relationshipCount - left.semantics.relationshipCount ||
        left.other.displayName.localeCompare(right.other.displayName, PANEL_CONTENT.nameLocale) ||
        left.connectionId.localeCompare(right.connectionId),
    );

  return (
    <GraphNetworkCharacterDetails
      bookId={bookId}
      connections={connections}
      counts={{
        pairsAvailable: connections.length,
        pairsOnMap: connections.filter((connection) => connection.isOnMap).length,
        relationsAvailable: connections.reduce(
          (sum, connection) => sum + connection.semantics.relationshipCount,
          0,
        ),
      }}
      groupLabel={groupLabelOf(node.id)}
      node={node}
      onExploreAround={() => onExploreAround(node.id)}
      onFindPath={() => onFindPath(node.id)}
      onFocusOnMap={isCharacterOnMap(node.id) ? () => onFocusOnMap(node.id) : null}
      onOpenConnection={onOpenConnection}
    />
  );
}

function MembersContent({
  index,
  isCharacterOnMap,
  onPickCharacter,
  target,
}: GraphNetworkPanelContentProps & {
  target: Extract<GraphNetworkPanelTarget, { kind: "members" }>;
}) {
  const members = target.bucket.memberIds.flatMap((memberId): GraphNetworkGroupMember[] => {
    const node = index.nodeById.get(memberId);
    if (node === undefined) return [];
    return [
      {
        isOnMap: isCharacterOnMap(memberId),
        node,
        pairCount: index.connectionIdsByNodeId.get(memberId)?.length ?? 0,
      },
    ];
  });

  return (
    <GraphNetworkGroupMembers
      groupLabel={target.label}
      members={members}
      onSelect={onPickCharacter}
    />
  );
}

function PairContent({
  bookId,
  index,
  reader,
  relationshipActions,
  target,
}: GraphNetworkPanelContentProps & {
  target: Extract<GraphNetworkPanelTarget, { kind: "connection" }>;
}) {
  const { connection, first, second } = target;
  const nameOf = (id: string) => index.nodeById.get(id)?.displayName ?? "";
  const edges = connection.edgeIds.flatMap((id): CharacterGraphEdgeView[] => {
    const edge = index.edgeById.get(id);
    return edge === undefined ? [] : [edge];
  });

  return (
    <>
      <GraphPersonPairHeader
        first={first}
        nameOf={nameOf}
        second={second}
        semantics={toGraphPairSemantics({ connection, edgeById: index.edgeById })}
      />
      <div className="flex shrink-0 grow flex-col gap-4">
        <GraphConnectionDetails
          actions={relationshipActions}
          contentKey={JSON.stringify([bookId, reader, connection.id])}
          edges={edges}
          key={connection.id}
          layout="panel"
          names={{ source: first.displayName, target: second.displayName }}
          renderEdge={(edge, edgeIndex) => (
            <GraphPersonEdgeRow edge={edge} index={edgeIndex} nameOf={nameOf} />
          )}
          scope={{ bookId, kind: "book" }}
        />
      </div>
    </>
  );
}

import type { CharacterGraphNodeView, Nullable } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { GraphConnection } from "../../model/workspace/graph-connections";
import type {
  NetworkAggregateLink,
  NetworkBucket,
  NetworkIndex,
} from "../../model/workspace/graph-network-index";
import type { GraphSceneSelection } from "./graph-scene-context";

export type GraphNetworkPanelTarget =
  | {
      bucket: NetworkBucket;
      kind: "members";
      label: string;
    }
  | {
      connection: GraphConnection;
      first: CharacterGraphNodeView;
      kind: "connection";
      second: CharacterGraphNodeView;
    }
  | {
      kind: "aggregate";
      link: NetworkAggregateLink;
      sourceLabel: string;
      targetLabel: string;
    }
  | {
      kind: "character";
      node: CharacterGraphNodeView;
    };

export function toGraphNetworkPanelTarget({
  index,
  labelOf,
  linkById,
  selection,
}: {
  index: NetworkIndex;
  labelOf: (bucket: NetworkBucket) => string;
  linkById: ReadonlyMap<string, NetworkAggregateLink>;
  selection: GraphSceneSelection;
}): Nullable<GraphNetworkPanelTarget> {
  if (selection === null) return null;
  switch (selection.kind) {
    case "aggregate": {
      const link = linkById.get(selection.id);
      if (link === undefined) return null;
      const endLabel = (id: string) => {
        const bucket = index.bucketById.get(id);
        return bucket === undefined ? (index.nodeById.get(id)?.displayName ?? "") : labelOf(bucket);
      };
      return {
        kind: "aggregate",
        link,
        sourceLabel: endLabel(link.sourceId),
        targetLabel: endLabel(link.targetId),
      };
    }
    case "character": {
      const node = index.nodeById.get(selection.id);
      return node === undefined ? null : { kind: "character", node };
    }
    case "connection": {
      const connection = index.connectionById.get(selection.id);
      const first = connection === undefined ? undefined : index.nodeById.get(connection.sourceId);
      const second = connection === undefined ? undefined : index.nodeById.get(connection.targetId);
      if (connection === undefined || first === undefined || second === undefined) return null;
      return { connection, first, kind: "connection", second };
    }
    case "members": {
      const bucket = index.bucketById.get(selection.id);
      return bucket === undefined ? null : { bucket, kind: "members", label: labelOf(bucket) };
    }
    default:
      return assertNever(selection);
  }
}

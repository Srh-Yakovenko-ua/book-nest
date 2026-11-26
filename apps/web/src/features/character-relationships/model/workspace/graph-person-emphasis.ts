import type { Nullable } from "@app/shared";

import type { GraphConnection } from "./graph-connections";

export type GraphPersonEmphasis = {
  characterIds: ReadonlySet<string>;
  connectionIds: ReadonlySet<string>;
};

export type GraphPersonFocus =
  null | { id: string; kind: "character" } | { id: string; kind: "connection" };

export function toGraphPersonEmphasis({
  connections,
  focus,
}: {
  connections: readonly GraphConnection[];
  focus: GraphPersonFocus;
}): Nullable<GraphPersonEmphasis> {
  if (focus === null) return null;
  if (focus.kind === "connection") {
    const connection = connections.find((entry) => entry.id === focus.id);
    if (connection === undefined) return null;
    return {
      characterIds: new Set([connection.sourceId, connection.targetId]),
      connectionIds: new Set([connection.id]),
    };
  }
  const incident = connections.filter(
    (connection) => connection.sourceId === focus.id || connection.targetId === focus.id,
  );
  return {
    characterIds: new Set([
      focus.id,
      ...incident.flatMap((connection) => [connection.sourceId, connection.targetId]),
    ]),
    connectionIds: new Set(incident.map((connection) => connection.id)),
  };
}

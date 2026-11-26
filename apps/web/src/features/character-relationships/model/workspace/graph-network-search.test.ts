import type { CharacterGraphClusterView, CharacterGraphNodeView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NetworkBucket, NetworkIndex } from "./graph-network-index";
import type { NetworkSearchResult } from "./graph-network-search";

import { makeRelationshipGraph, makeRelationshipGraphNode } from "../relationships.fixtures";
import { buildNetworkIndex } from "./graph-network-index";
import { searchNetwork } from "./graph-network-search";

const MAP = indexOf({
  clusters: [group("keep", "Keep"), group("marauders", "Marauders"), group("market", "Old Market")],
  nodes: [
    character({ clusterId: "marauders", displayName: "Jon Snow", id: "jon-a" }),
    character({ clusterId: "marauders", displayName: "Marcus", id: "marcus" }),
    character({ clusterId: "market", displayName: "Jon Snow", id: "jon-b" }),
    character({ clusterId: "market", displayName: "Tamara", id: "tamara" }),
    character({ clusterId: "keep", displayName: "Old Mara", id: "old-mara" }),
    character({ clusterId: "keep", displayName: "The Wolf", id: "wolf", name: "Geralt" }),
  ],
});

const MAR_RESULTS = [
  "group:marauders",
  "character:marcus",
  "group:market",
  "character:old-mara",
  "character:tamara",
];

describe("searchNetwork", () => {
  it.each(["", "   "])("finds nothing for the query '%s'", (query) => {
    expect(search({ query })).toEqual([]);
  });

  it("ranks prefix, word and inner matches, groups first among equal matches", () => {
    expect(search({ query: "mar" }).map(describeResult)).toEqual(MAR_RESULTS);
  });

  it("finds a character by its name when the display name differs", () => {
    expect(search({ query: "geralt" }).map(describeResult)).toEqual(["character:wolf"]);
  });

  it("keeps namesakes apart with their own ids and groups", () => {
    const namesakes = search({ query: "jon snow" }).flatMap((result) =>
      result.kind === "character" ? [{ bucketId: result.bucketId, id: result.node.id }] : [],
    );

    expect(namesakes).toEqual([
      { bucketId: "cluster:group:marauders", id: "jon-a" },
      { bucketId: "cluster:group:market", id: "jon-b" },
    ]);
  });

  it("lists a character hidden by the filters as blocked after the shown matches", () => {
    const blockedNodes = [character({ clusterId: null, displayName: "Marek", id: "marek" })];

    expect(search({ blockedNodes, query: "mar" }).map(describeResult)).toEqual([
      "group:marauders",
      "character:marcus",
      "blocked:marek",
      "group:market",
      "character:old-mara",
      "character:tamara",
    ]);
  });

  it("never lists a character of the map as blocked", () => {
    const blockedNodes = [character({ clusterId: null, displayName: "Marcus", id: "marcus" })];

    expect(search({ blockedNodes, query: "mar" }).map(describeResult)).toEqual(MAR_RESULTS);
  });

  it("returns at most thirty results", () => {
    const ids = Array.from({ length: 35 }, (_, offset) => String(offset + 1).padStart(2, "0"));
    const camp = indexOf({
      clusters: [group("camp", "Camp")],
      nodes: ids.map((id) =>
        character({ clusterId: "camp", displayName: `Soldier ${id}`, id: `soldier-${id}` }),
      ),
    });
    const results = searchNetwork({ blockedNodes: [], index: camp, labelOf, query: "soldier" });

    expect(results.map(describeResult)).toEqual(
      ids.slice(0, 30).map((id) => `character:soldier-${id}`),
    );
  });
});

function character({
  clusterId,
  displayName,
  id,
  name = displayName,
}: Pick<CharacterGraphNodeView, "clusterId" | "displayName" | "id"> & {
  name?: string;
}): CharacterGraphNodeView {
  return makeRelationshipGraphNode({ clusterId, displayName, id, name });
}

function describeResult(result: NetworkSearchResult): string {
  if (result.kind === "group") return `group:${result.bucket.key}`;
  return `${result.kind}:${result.node.id}`;
}

function group(id: string, name: string): CharacterGraphClusterView {
  return { groupType: "family", id, kind: "group", name, size: 1 };
}

function indexOf({
  clusters,
  nodes,
}: {
  clusters: CharacterGraphClusterView[];
  nodes: CharacterGraphNodeView[];
}): NetworkIndex {
  return buildNetworkIndex({
    graph: makeRelationshipGraph({ clusters, edges: [], nodes }),
    grouping: "group",
  });
}

function labelOf(bucket: NetworkBucket): string {
  return bucket.label.kind === "group" ? (bucket.label.name ?? "") : bucket.key;
}

function search({
  blockedNodes = [],
  query,
}: {
  blockedNodes?: CharacterGraphNodeView[];
  query: string;
}): NetworkSearchResult[] {
  return searchNetwork({ blockedNodes, index: MAP, labelOf, query });
}

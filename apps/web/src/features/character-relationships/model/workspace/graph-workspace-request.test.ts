import { describe, expect, it } from "vitest";

import type { GraphWorkspaceParams } from "./graph-workspace-params";

import { GRAPH_WORKSPACE_VIEWS } from "./graph-workspace-params";
import {
  toBookGraphRequestParams,
  toGraphWorkspacePathRequest,
  toGraphWorkspaceSceneRequest,
} from "./graph-workspace-request";

const CHARACTER = {
  ciri: "c1c1c1c1-0000-4000-8000-000000000001",
  geralt: "9e9e9e9e-0000-4000-8000-000000000002",
} as const;

const DEFAULT_PARAMS: GraphWorkspaceParams = {
  categories: [],
  characterId: null,
  depth: 1,
  from: null,
  networkGroup: "group",
  path: false,
  to: null,
  treeDown: 2,
  treeUp: 2,
  types: [],
  view: "person",
};

const FILTERED_PARAMS: GraphWorkspaceParams = {
  ...DEFAULT_PARAMS,
  categories: ["family", "social"],
  types: ["spouse_of", "friend_of"],
};

describe("toGraphWorkspaceSceneRequest", () => {
  it.each(["person", "tree"] as const)("asks for no %s graph without a character", (view) => {
    expect(toGraphWorkspaceSceneRequest({ ...DEFAULT_PARAMS, view })).toBeNull();
  });

  it.each(GRAPH_WORKSPACE_VIEWS)("asks for no graph while a path is open in %s", (view) => {
    const request = toGraphWorkspaceSceneRequest({
      ...DEFAULT_PARAMS,
      characterId: CHARACTER.geralt,
      from: CHARACTER.geralt,
      path: true,
      to: CHARACTER.ciri,
      view,
    });

    expect(request).toBeNull();
  });
});

describe("graph API params of the scene request", () => {
  it("asks the network view for the whole book by group, with the filters and no focus", () => {
    const params = toApiParams({
      ...FILTERED_PARAMS,
      characterId: CHARACTER.geralt,
      view: "network",
    });

    expect(params).toEqual({
      categories: ["family", "social"],
      clusterBy: "group",
      mode: "all",
      relationshipTypes: ["spouse_of", "friend_of"],
    });
  });

  it("sends no filter params while no filter is selected", () => {
    expect(toApiParams({ ...DEFAULT_PARAMS, view: "network" })).toEqual({
      clusterBy: "group",
      mode: "all",
    });
  });

  it("asks the person view for the focus character, its depth and the filters", () => {
    const params = toApiParams({
      ...FILTERED_PARAMS,
      characterId: CHARACTER.geralt,
      depth: 3,
      view: "person",
    });

    expect(params).toEqual({
      categories: ["family", "social"],
      depth: 3,
      focusCharacterId: CHARACTER.geralt,
      mode: "all",
      relationshipTypes: ["spouse_of", "friend_of"],
    });
  });

  it("asks the tree view for the family tree projection only, ignoring the filters", () => {
    const params = toApiParams({
      ...FILTERED_PARAMS,
      characterId: CHARACTER.geralt,
      depth: 3,
      networkGroup: "importance",
      treeDown: 1,
      treeUp: 3,
      view: "tree",
    });

    expect(params).toEqual({
      ancestors: 3,
      descendants: 1,
      focusCharacterId: CHARACTER.geralt,
      projection: "family_tree",
    });
  });
});

describe("toGraphWorkspacePathRequest", () => {
  it("asks for the path between two characters with only the filters and the endpoints", () => {
    const request = toGraphWorkspacePathRequest({
      ...FILTERED_PARAMS,
      depth: 3,
      from: CHARACTER.geralt,
      networkGroup: "importance",
      path: true,
      to: CHARACTER.ciri,
      treeDown: 1,
      treeUp: 3,
      view: "network",
    });

    expect(request).toEqual({
      categories: ["family", "social"],
      fromId: CHARACTER.geralt,
      kind: "path",
      toId: CHARACTER.ciri,
      types: ["spouse_of", "friend_of"],
    });
  });

  it.each<{ endpoints: Pick<GraphWorkspaceParams, "from" | "path" | "to">; label: string }>([
    {
      endpoints: { from: CHARACTER.geralt, path: false, to: CHARACTER.ciri },
      label: "the path is closed",
    },
    { endpoints: { from: CHARACTER.geralt, path: true, to: null }, label: "the target is missing" },
    { endpoints: { from: null, path: true, to: CHARACTER.ciri }, label: "the source is missing" },
    {
      endpoints: { from: CHARACTER.geralt, path: true, to: CHARACTER.geralt },
      label: "both ends are the same character",
    },
  ])("asks for no path when $label", ({ endpoints }) => {
    expect(toGraphWorkspacePathRequest({ ...FILTERED_PARAMS, ...endpoints })).toBeNull();
  });
});

function toApiParams(params: GraphWorkspaceParams) {
  const request = toGraphWorkspaceSceneRequest(params);
  return request === null ? null : toBookGraphRequestParams(request);
}

import type { RelationshipType } from "@app/shared";

import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
  canonicalizeGraphWorkspaceParams,
  graphWorkspaceParsers,
  needsGraphWorkspaceCanonicalReplace,
  normalizeGraphWorkspaceFilters,
  toAllowedGraphWorkspaceTypes,
} from "./graph-workspace-params";

const CHARACTER = {
  ciri: "c1c1c1c1-0000-4000-8000-000000000001",
  geralt: "9e9e9e9e-0000-4000-8000-000000000002",
} as const;

const loadGraphWorkspaceParams = createLoader(graphWorkspaceParsers);

const DEFAULT_PARAMS = loadGraphWorkspaceParams(new URLSearchParams());

describe("normalizeGraphWorkspaceFilters", () => {
  it("dedupes the categories and orders them by the shared category order", () => {
    const filters = normalizeGraphWorkspaceFilters({
      categories: ["social", "family", "social"],
      types: [],
    });

    expect(filters.categories).toEqual(["family", "social"]);
  });

  it("keeps every type, deduped and in the shared type order, when no category is selected", () => {
    const filters = normalizeGraphWorkspaceFilters({
      categories: [],
      types: ["enemy_of", "friend_of", "spouse_of", "friend_of"],
    });

    expect(filters.types).toEqual(["spouse_of", "friend_of", "enemy_of"]);
  });

  it("drops the types that belong to none of the selected categories", () => {
    const filters = normalizeGraphWorkspaceFilters({
      categories: ["social"],
      types: ["enemy_of", "friend_of", "spouse_of"],
    });

    expect(filters).toEqual({ categories: ["social"], types: ["friend_of"] });
  });
});

describe("toAllowedGraphWorkspaceTypes", () => {
  it("allows every type when no category is selected", () => {
    expect(toAllowedGraphWorkspaceTypes([])).toBeNull();
  });

  it("allows only the types of the selected categories", () => {
    const allowed = toAllowedGraphWorkspaceTypes(["family", "social"]);
    const candidates: RelationshipType[] = ["enemy_of", "friend_of", "mentor_of", "spouse_of"];

    expect(candidates.filter((type) => allowed?.has(type))).toEqual(["friend_of", "spouse_of"]);
  });
});

describe("canonicalizeGraphWorkspaceParams", () => {
  it("drops the path endpoints while the path is closed", () => {
    const canonical = canonicalizeGraphWorkspaceParams({
      ...DEFAULT_PARAMS,
      from: CHARACTER.geralt,
      to: CHARACTER.ciri,
    });

    expect(canonical).toMatchObject({ from: null, path: false, to: null });
  });

  it("keeps the path endpoints while the path is open", () => {
    const canonical = canonicalizeGraphWorkspaceParams({
      ...DEFAULT_PARAMS,
      from: CHARACTER.geralt,
      path: true,
      to: CHARACTER.ciri,
    });

    expect(canonical).toMatchObject({ from: CHARACTER.geralt, path: true, to: CHARACTER.ciri });
  });

  it("normalizes the filters it carries", () => {
    const canonical = canonicalizeGraphWorkspaceParams({
      ...DEFAULT_PARAMS,
      categories: ["social", "family"],
      types: ["enemy_of", "friend_of"],
    });

    expect(canonical).toMatchObject({ categories: ["family", "social"], types: ["friend_of"] });
  });
});

describe("needsGraphWorkspaceCanonicalReplace", () => {
  it.each([
    "depth=7",
    "view=bogus",
    "characterId=not-a-uuid",
    "view=person",
    "depth=1",
    "categories=social,family",
    `from=${CHARACTER.geralt}`,
  ])("asks for a replace when the URL reads '%s'", (query) => {
    expect(needsReplaceFor(query)).toBe(true);
  });

  it.each([
    "",
    `characterId=${CHARACTER.geralt}&depth=3`,
    "categories=family,social&types=spouse_of,friend_of&view=network",
    `from=${CHARACTER.geralt}&path=1&to=${CHARACTER.ciri}&view=tree`,
  ])("leaves the canonical URL '%s' alone", (query) => {
    expect(needsReplaceFor(query)).toBe(false);
  });
});

function needsReplaceFor(query: string): boolean {
  const search = new URLSearchParams(query);
  return needsGraphWorkspaceCanonicalReplace({
    canonical: canonicalizeGraphWorkspaceParams(loadGraphWorkspaceParams(search)),
    search,
  });
}

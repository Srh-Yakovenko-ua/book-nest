import type { RelationshipType } from "@app/shared";

import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
  canonicalizeGraphWorkspaceParams,
  graphWorkspaceParsers,
  needsGraphWorkspaceCanonicalReplace,
  normalizeGraphWorkspaceFilters,
  toAllowedGraphWorkspaceTypes,
  toTreeLinks,
  toTreeOptions,
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

  it("keeps the focused network group in the network view", () => {
    const canonical = canonicalizeGraphWorkspaceParams({
      ...DEFAULT_PARAMS,
      networkFocus: "north",
      view: "network",
    });

    expect(canonical.networkFocus).toBe("north");
  });

  it.each(["person", "tree"] as const)("drops the focused network group in the %s view", (view) => {
    const canonical = canonicalizeGraphWorkspaceParams({
      ...DEFAULT_PARAMS,
      networkFocus: "north",
      view,
    });

    expect(canonical.networkFocus).toBeNull();
  });

  it("drops the focused network group while the path is open", () => {
    const canonical = canonicalizeGraphWorkspaceParams({
      ...DEFAULT_PARAMS,
      networkFocus: "north",
      path: true,
      view: "network",
    });

    expect(canonical.networkFocus).toBeNull();
  });
});

describe("networkFocus", () => {
  it("reads no focused group when the URL names none", () => {
    expect(loadGraphWorkspaceParams(new URLSearchParams("view=network")).networkFocus).toBeNull();
  });

  it("reads the focused group key in lower case", () => {
    const params = loadGraphWorkspaceParams(
      new URLSearchParams("networkFocus=F1F1F1F1-0000-4000-8000-00000000000A_x&view=network"),
    );

    expect(params.networkFocus).toBe("f1f1f1f1-0000-4000-8000-00000000000a_x");
  });

  it("reads a key of 64 characters", () => {
    const key = "a".repeat(64);
    const params = loadGraphWorkspaceParams(new URLSearchParams({ networkFocus: key }));

    expect(params.networkFocus).toBe(key);
  });

  it.each(["", "a.b", "a/b", "has space", "a:b", "a".repeat(65)])(
    "reads no focused group for the key '%s'",
    (key) => {
      const params = loadGraphWorkspaceParams(new URLSearchParams({ networkFocus: key }));

      expect(params.networkFocus).toBeNull();
    },
  );
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
    "treeLinks=siblings,marriages",
    "treeLinks=marriages,siblings,guardians,distant",
    "treeLinks=foo",
    "treeScope=branch&view=tree",
    "treeScope=bogus&view=tree",
    "networkFocus=north",
    "networkFocus=North&view=network",
    "networkFocus=a.b&view=network",
    "networkFocus=north&path=1&view=network",
  ])("asks for a replace when the URL reads '%s'", (query) => {
    expect(needsReplaceFor(query)).toBe(true);
  });

  it.each([
    "",
    `characterId=${CHARACTER.geralt}&depth=3`,
    "categories=family,social&types=spouse_of,friend_of&view=network",
    `from=${CHARACTER.geralt}&path=1&to=${CHARACTER.ciri}&view=tree`,
    "treeLinks=marriages,siblings&view=tree",
    "treeLinks=none&view=tree",
    "treeScope=full&view=tree",
    "networkFocus=north&view=network",
  ])("leaves the canonical URL '%s' alone", (query) => {
    expect(needsReplaceFor(query)).toBe(false);
  });
});

describe("treeLinks", () => {
  it("shows marriages, siblings, guardians and distant relatives when the URL names none", () => {
    expect(loadGraphWorkspaceParams(new URLSearchParams()).treeLinks).toEqual([
      "marriages",
      "siblings",
      "guardians",
      "distant",
    ]);
  });

  it("shows no tree links for treeLinks=none", () => {
    expect(loadGraphWorkspaceParams(new URLSearchParams("treeLinks=none")).treeLinks).toEqual([]);
  });

  it("reads the tree links in the canonical order", () => {
    const params = loadGraphWorkspaceParams(new URLSearchParams("treeLinks=siblings,marriages"));

    expect(params.treeLinks).toEqual(["marriages", "siblings"]);
  });

  it.each(["treeLinks=foo", "treeLinks=marriages,foo"])(
    "falls back to the default tree links for '%s'",
    (query) => {
      expect(loadGraphWorkspaceParams(new URLSearchParams(query)).treeLinks).toEqual([
        "marriages",
        "siblings",
        "guardians",
        "distant",
      ]);
    },
  );

  it("leaves the relationship filters untouched", () => {
    const canonical = canonicalizeGraphWorkspaceParams(
      loadGraphWorkspaceParams(new URLSearchParams("categories=family&treeLinks=siblings")),
    );

    expect(canonical).toMatchObject({ categories: ["family"], treeLinks: ["siblings"], types: [] });
  });
});

describe("treeScope", () => {
  it("shows a branch of the tree when the URL names no scope", () => {
    expect(loadGraphWorkspaceParams(new URLSearchParams("view=tree")).treeScope).toBe("branch");
  });

  it("shows the whole genealogy for treeScope=full", () => {
    const params = loadGraphWorkspaceParams(new URLSearchParams("treeScope=full&view=tree"));

    expect(params.treeScope).toBe("full");
  });

  it.each(["treeScope=bogus", "treeScope=whole"])(
    "falls back to a branch of the tree for '%s'",
    (query) => {
      expect(loadGraphWorkspaceParams(new URLSearchParams(query)).treeScope).toBe("branch");
    },
  );
});

describe("toTreeOptions", () => {
  it("switches on exactly the listed tree links", () => {
    expect(toTreeOptions(["siblings", "exUnions"])).toEqual({
      distant: false,
      exUnions: true,
      guardians: false,
      marriages: false,
      siblings: true,
    });
  });
});

describe("toTreeLinks", () => {
  it("lists the switched-on tree links in the canonical order", () => {
    expect(
      toTreeLinks({
        distant: true,
        exUnions: false,
        guardians: false,
        marriages: true,
        siblings: true,
      }),
    ).toEqual(["marriages", "siblings", "distant"]);
  });
});

function needsReplaceFor(query: string): boolean {
  const search = new URLSearchParams(query);
  return needsGraphWorkspaceCanonicalReplace({
    canonical: canonicalizeGraphWorkspaceParams(loadGraphWorkspaceParams(search)),
    search,
  });
}

import type { CharacterGraphEdgeView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GraphPairEntry, GraphPairTone } from "./graph-person-semantics";

import { makeRelationshipGraphEdge, RELATIONSHIP_FIXTURE } from "../relationships.fixtures";
import { toGraphConnectionId, toGraphConnections } from "./graph-connections";
import {
  filterGraphPairEntries,
  toGraphCharacterReach,
  toGraphPairEntries,
  toGraphPairSemantics,
  toGraphPairSemanticsById,
  toGraphPersonLabelPairIds,
} from "./graph-person-semantics";

const CHARACTER = {
  ciri: RELATIONSHIP_FIXTURE.ciri.id,
  geralt: RELATIONSHIP_FIXTURE.geralt.id,
  yennefer: RELATIONSHIP_FIXTURE.yennefer.id,
} as const;

const PERSON = {
  alina: { id: "55555555-5555-4555-8555-555555555555", name: "Аліна" },
  bohdan: { id: "44444444-4444-4444-8444-444444444444", name: "Богдан" },
  dmytro: { id: "11111111-1111-4111-8111-111111111111", name: "Дмитро" },
  halyna: { id: "22222222-2222-4222-8222-222222222222", name: "Галина" },
  vasyl: { id: "33333333-3333-4333-8333-333333333333", name: "Василь" },
} as const;

const RELATIONSHIP = {
  fifth: "e5e5e5e5-0000-4000-8000-000000000005",
  first: "e1e1e1e1-0000-4000-8000-000000000001",
  fourth: "e4e4e4e4-0000-4000-8000-000000000004",
  second: "e2e2e2e2-0000-4000-8000-000000000002",
  third: "e3e3e3e3-0000-4000-8000-000000000003",
} as const;

const SEMANTICS = {
  adoptiveParent: { type: "adoptive_parent_of" },
  mentor: { category: "mentorship", type: "mentor_of" },
} as const satisfies Record<string, Partial<CharacterGraphEdgeView>>;

const MASKED_EDGE_CASES: { label: string; overrides: Partial<CharacterGraphEdgeView> }[] = [
  { label: "hides its type", overrides: { typeHidden: true } },
  { label: "has no type", overrides: { type: null } },
  { label: "has no category", overrides: { category: null } },
];

const NAME_BY_ID = new Map<string, string>(Object.values(PERSON).map(({ id, name }) => [id, name]));

const NAMED_PAIRS = toGraphConnections([
  relationship(RELATIONSHIP.first, PERSON.vasyl.id, PERSON.dmytro.id),
  relationship(RELATIONSHIP.second, PERSON.vasyl.id, PERSON.alina.id),
  relationship(RELATIONSHIP.third, PERSON.halyna.id, PERSON.bohdan.id),
  relationship(RELATIONSHIP.fourth, PERSON.dmytro.id, PERSON.alina.id),
  relationship(RELATIONSHIP.fifth, PERSON.alina.id, PERSON.bohdan.id),
]);

describe("toGraphPairSemantics", () => {
  it.each<{ edges: CharacterGraphEdgeView[]; label: string; tone: GraphPairTone }>([
    {
      edges: [relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri, SEMANTICS.mentor)],
      label: "its only edge is visible",
      tone: "mentorship",
    },
    {
      edges: [
        relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
        relationship(
          RELATIONSHIP.second,
          CHARACTER.geralt,
          CHARACTER.ciri,
          SEMANTICS.adoptiveParent,
        ),
      ],
      label: "its edges share a category and a direction",
      tone: "family",
    },
    {
      edges: [
        relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
        relationship(RELATIONSHIP.second, CHARACTER.geralt, CHARACTER.ciri, SEMANTICS.mentor),
      ],
      label: "its edges have different categories",
      tone: "mixed",
    },
    {
      edges: [
        relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
        relationship(RELATIONSHIP.second, CHARACTER.ciri, CHARACTER.geralt),
      ],
      label: "its edges share a category but run in opposite directions",
      tone: "mixed",
    },
  ])("tones a pair as $tone when $label", ({ edges, tone }) => {
    expect(semanticsOf(edges).map((semantics) => semantics.tone)).toEqual([tone]);
  });

  it.each(MASKED_EDGE_CASES)("masks a pair whose only edge $label", ({ overrides }) => {
    const edges = [relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri, overrides)];

    expect(semanticsOf(edges).map((semantics) => semantics.tone)).toEqual(["masked"]);
  });

  it.each(MASKED_EDGE_CASES)(
    "masks the whole pair when one edge $label beside a visible one",
    ({ overrides }) => {
      const edges = [
        relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
        relationship(RELATIONSHIP.second, CHARACTER.geralt, CHARACTER.ciri, overrides),
      ];

      expect(semanticsOf(edges).map((semantics) => semantics.tone)).toEqual(["masked"]);
    },
  );

  it("exposes the edge of a pair with exactly one visible edge", () => {
    const edge = relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri);

    expect(semanticsOf([edge]).map((semantics) => semantics.singleEdge)).toEqual([edge]);
  });

  it.each<{ edges: CharacterGraphEdgeView[]; label: string }>([
    {
      edges: [
        relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri, { typeHidden: true }),
      ],
      label: "its only edge is masked",
    },
    {
      edges: [
        relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
        relationship(
          RELATIONSHIP.second,
          CHARACTER.geralt,
          CHARACTER.ciri,
          SEMANTICS.adoptiveParent,
        ),
      ],
      label: "it has several edges",
    },
  ])("exposes no single edge for a pair when $label", ({ edges }) => {
    expect(semanticsOf(edges).map((semantics) => semantics.singleEdge)).toEqual([null]);
  });

  it("counts every edge of the pair", () => {
    const edges = [
      relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
      relationship(RELATIONSHIP.second, CHARACTER.geralt, CHARACTER.ciri, SEMANTICS.adoptiveParent),
      relationship(RELATIONSHIP.third, CHARACTER.ciri, CHARACTER.geralt, SEMANTICS.mentor),
    ];

    expect(semanticsOf(edges).map((semantics) => semantics.relationshipCount)).toEqual([3]);
  });

  it("passes the direction of the pair through", () => {
    const edges = [relationship(RELATIONSHIP.first, CHARACTER.ciri, CHARACTER.geralt)];

    expect(semanticsOf(edges).map((semantics) => semantics.direction)).toEqual([
      { kind: "directed", sourceId: CHARACTER.ciri, targetId: CHARACTER.geralt },
    ]);
  });
});

describe("toGraphPersonLabelPairIds", () => {
  it("labels only the visible pairs that touch the root", () => {
    const edges = [
      relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
      relationship(RELATIONSHIP.second, CHARACTER.geralt, CHARACTER.yennefer, { typeHidden: true }),
      relationship(RELATIONSHIP.third, CHARACTER.ciri, CHARACTER.yennefer),
    ];

    expect(labelledPairIdsAroundGeralt(edges)).toEqual(
      new Set([toGraphConnectionId(CHARACTER.geralt, CHARACTER.ciri)]),
    );
  });

  it.each([
    { labelled: 8, pairs: 8 },
    { labelled: 0, pairs: 9 },
  ])("labels $labelled pairs when the root has $pairs pairs", ({ labelled, pairs }) => {
    const edges = Array.from({ length: pairs }, (_, index) =>
      relationship(`edge-${index}`, CHARACTER.geralt, `neighbour-${index}`),
    );

    expect(labelledPairIdsAroundGeralt(edges).size).toBe(labelled);
  });
});

describe("toGraphCharacterReach", () => {
  it.each([
    {
      characterId: CHARACTER.geralt,
      label: "Geralt",
      reach: { neighbors: 2, relationships: 3 },
    },
    {
      characterId: CHARACTER.yennefer,
      label: "Yennefer",
      reach: { neighbors: 2, relationships: 2 },
    },
  ])("counts the neighbours and relationship records of $label", ({ characterId, reach }) => {
    const connections = toGraphConnections([
      relationship(RELATIONSHIP.first, CHARACTER.geralt, CHARACTER.ciri),
      relationship(RELATIONSHIP.second, CHARACTER.geralt, CHARACTER.ciri, SEMANTICS.adoptiveParent),
      relationship(RELATIONSHIP.third, CHARACTER.geralt, CHARACTER.yennefer),
      relationship(RELATIONSHIP.fourth, CHARACTER.ciri, CHARACTER.yennefer),
    ]);

    expect(toGraphCharacterReach({ characterId, connections })).toEqual(reach);
  });
});

describe("toGraphPairEntries", () => {
  it("lists the root pairs first by the other name, then the rest by first and second name", () => {
    const entries = toGraphPairEntries({
      connections: NAMED_PAIRS,
      nameOf,
      rootId: PERSON.vasyl.id,
    });

    expect(entries.map(pairNames)).toEqual([
      [PERSON.vasyl.name, PERSON.alina.name],
      [PERSON.vasyl.name, PERSON.dmytro.name],
      [PERSON.alina.name, PERSON.bohdan.name],
      [PERSON.alina.name, PERSON.dmytro.name],
      [PERSON.bohdan.name, PERSON.halyna.name],
    ]);
  });

  it("marks only the pairs that touch the root as involving it", () => {
    const entries = toGraphPairEntries({
      connections: NAMED_PAIRS,
      nameOf,
      rootId: PERSON.vasyl.id,
    });

    expect(entries.map((entry) => entry.involvesRoot)).toEqual([true, true, false, false, false]);
  });

  it("orders every pair by first and second name when there is no root", () => {
    const entries = toGraphPairEntries({ connections: NAMED_PAIRS, nameOf, rootId: null });

    expect(entries.map(pairNames)).toEqual([
      [PERSON.alina.name, PERSON.bohdan.name],
      [PERSON.alina.name, PERSON.vasyl.name],
      [PERSON.alina.name, PERSON.dmytro.name],
      [PERSON.bohdan.name, PERSON.halyna.name],
      [PERSON.vasyl.name, PERSON.dmytro.name],
    ]);
  });
});

describe("filterGraphPairEntries", () => {
  const entries = toGraphPairEntries({ connections: NAMED_PAIRS, nameOf, rootId: PERSON.vasyl.id });

  it.each(["", "   "])("keeps every pair for the blank query %j", (query) => {
    expect(filterGraphPairEntries({ entries, nameOf, query })).toEqual(entries);
  });

  it("matches a name regardless of letter case", () => {
    const found = filterGraphPairEntries({ entries, nameOf, query: "ДМИТ" });

    expect(found.map(pairNames)).toEqual([
      [PERSON.vasyl.name, PERSON.dmytro.name],
      [PERSON.alina.name, PERSON.dmytro.name],
    ]);
  });

  it("matches a substring of either name in the pair", () => {
    const found = filterGraphPairEntries({ entries, nameOf, query: "гдан" });

    expect(found.map(pairNames)).toEqual([
      [PERSON.alina.name, PERSON.bohdan.name],
      [PERSON.bohdan.name, PERSON.halyna.name],
    ]);
  });

  it("finds nothing when no name contains the query", () => {
    expect(filterGraphPairEntries({ entries, nameOf, query: "Ярема" })).toEqual([]);
  });
});

function labelledPairIdsAroundGeralt(
  edges: readonly CharacterGraphEdgeView[],
): ReadonlySet<string> {
  const connections = toGraphConnections(edges);
  return toGraphPersonLabelPairIds({
    connections,
    rootId: CHARACTER.geralt,
    semantics: toGraphPairSemanticsById({ connections, edges }),
  });
}

function nameOf(id: string): string {
  return NAME_BY_ID.get(id) ?? id;
}

function pairNames(entry: GraphPairEntry): string[] {
  return [nameOf(entry.firstId), nameOf(entry.secondId)];
}

function relationship(
  id: string,
  source: string,
  target: string,
  overrides: Partial<CharacterGraphEdgeView> = {},
): CharacterGraphEdgeView {
  return makeRelationshipGraphEdge({ ...overrides, id, source, target });
}

function semanticsOf(edges: readonly CharacterGraphEdgeView[]) {
  const edgeById = new Map(edges.map((edge) => [edge.id, edge] as const));
  return toGraphConnections(edges).map((connection) =>
    toGraphPairSemantics({ connection, edgeById }),
  );
}

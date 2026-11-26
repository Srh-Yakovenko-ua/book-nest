import { describe, expect, it } from "vitest";

import { makeRelationshipGraphEdge, RELATIONSHIP_FIXTURE } from "../relationships.fixtures";
import { toGraphConnectionId, toGraphConnections } from "./graph-connections";
import { toGraphPersonEmphasis } from "./graph-person-emphasis";

const CHARACTER = {
  ciri: RELATIONSHIP_FIXTURE.ciri.id,
  dandelion: "d4d4d4d4-0000-4000-8000-000000000004",
  geralt: RELATIONSHIP_FIXTURE.geralt.id,
  vesemir: "f5f5f5f5-0000-4000-8000-000000000005",
  yennefer: RELATIONSHIP_FIXTURE.yennefer.id,
} as const;

const PAIR = {
  ciriGeralt: toGraphConnectionId(CHARACTER.ciri, CHARACTER.geralt),
  ciriYennefer: toGraphConnectionId(CHARACTER.ciri, CHARACTER.yennefer),
} as const;

const CONNECTIONS = toGraphConnections([
  makeRelationshipGraphEdge({
    id: "e1e1e1e1-0000-4000-8000-000000000001",
    source: CHARACTER.geralt,
    target: CHARACTER.ciri,
  }),
  makeRelationshipGraphEdge({
    id: "e2e2e2e2-0000-4000-8000-000000000002",
    source: CHARACTER.ciri,
    target: CHARACTER.yennefer,
  }),
  makeRelationshipGraphEdge({
    id: "e3e3e3e3-0000-4000-8000-000000000003",
    source: CHARACTER.yennefer,
    target: CHARACTER.dandelion,
  }),
]);

describe("toGraphPersonEmphasis", () => {
  it("emphasises nothing without a focus", () => {
    expect(toGraphPersonEmphasis({ connections: CONNECTIONS, focus: null })).toBeNull();
  });

  it("emphasises a focused character with every neighbour and only its own pairs", () => {
    const emphasis = toGraphPersonEmphasis({
      connections: CONNECTIONS,
      focus: { id: CHARACTER.ciri, kind: "character" },
    });

    expect(emphasis).toEqual({
      characterIds: new Set([CHARACTER.ciri, CHARACTER.geralt, CHARACTER.yennefer]),
      connectionIds: new Set([PAIR.ciriGeralt, PAIR.ciriYennefer]),
    });
  });

  it("emphasises only the focused character when it has no pairs", () => {
    const emphasis = toGraphPersonEmphasis({
      connections: CONNECTIONS,
      focus: { id: CHARACTER.vesemir, kind: "character" },
    });

    expect(emphasis).toEqual({
      characterIds: new Set([CHARACTER.vesemir]),
      connectionIds: new Set(),
    });
  });

  it("emphasises a focused pair with its two characters", () => {
    const emphasis = toGraphPersonEmphasis({
      connections: CONNECTIONS,
      focus: { id: PAIR.ciriYennefer, kind: "connection" },
    });

    expect(emphasis).toEqual({
      characterIds: new Set([CHARACTER.ciri, CHARACTER.yennefer]),
      connectionIds: new Set([PAIR.ciriYennefer]),
    });
  });

  it("emphasises nothing for a focused pair that is not on the map", () => {
    const emphasis = toGraphPersonEmphasis({
      connections: CONNECTIONS,
      focus: { id: toGraphConnectionId(CHARACTER.geralt, CHARACTER.vesemir), kind: "connection" },
    });

    expect(emphasis).toBeNull();
  });
});

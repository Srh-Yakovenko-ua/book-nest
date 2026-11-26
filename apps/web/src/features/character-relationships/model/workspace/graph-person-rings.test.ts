import { describe, expect, it } from "vitest";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";

import { toGraphPersonRings } from "./graph-person-rings";

const CHARACTER = {
  distantEast: "d1d1d1d1-0000-4000-8000-000000000001",
  distantNorth: "d2d2d2d2-0000-4000-8000-000000000002",
  nearEast: "a1a1a1a1-0000-4000-8000-000000000001",
  nearSouth: "a2a2a2a2-0000-4000-8000-000000000002",
  nearWest: "a3a3a3a3-0000-4000-8000-000000000003",
  root: "9e9e9e9e-0000-4000-8000-000000000002",
} as const;

const HOPS = new Map<string, number>([
  [CHARACTER.distantEast, 2],
  [CHARACTER.distantNorth, 2],
  [CHARACTER.nearEast, 1],
  [CHARACTER.nearSouth, 1],
  [CHARACTER.nearWest, 1],
  [CHARACTER.root, 0],
]);

const POSITIONS = new Map<string, RelationshipGraphPoint>([
  [CHARACTER.distantEast, { x: 220, y: 100 }],
  [CHARACTER.distantNorth, { x: 100, y: -20 }],
  [CHARACTER.nearEast, { x: 150, y: 100 }],
  [CHARACTER.nearSouth, { x: 100, y: 150 }],
  [CHARACTER.nearWest, { x: 50, y: 100 }],
  [CHARACTER.root, { x: 100, y: 100 }],
]);

describe("toGraphPersonRings", () => {
  it("draws one ring per hop at the distance of its characters, nearest hop first", () => {
    const rings = toGraphPersonRings({ hops: HOPS, positions: POSITIONS });

    expect(rings?.radii.map(({ hop, radius }) => ({ hop, radius }))).toEqual([
      { hop: 1, radius: 50 },
      { hop: 2, radius: 120 },
    ]);
  });

  it("centres the rings on the root", () => {
    const rings = toGraphPersonRings({ hops: HOPS, positions: POSITIONS });

    expect(rings?.center).toEqual({ x: 100, y: 100 });
  });

  it("omits the ring of a hop whose characters sit more than 6 px apart in distance", () => {
    const positions = new Map(POSITIONS).set(CHARACTER.distantNorth, { x: 100, y: -30 });
    const rings = toGraphPersonRings({ hops: HOPS, positions });

    expect(rings?.radii.map((ring) => ring.hop)).toEqual([1]);
  });

  it("keeps the ring of a hop whose characters sit exactly 6 px apart in distance", () => {
    const positions = new Map(POSITIONS).set(CHARACTER.distantNorth, { x: 100, y: -26 });
    const rings = toGraphPersonRings({ hops: HOPS, positions });

    expect(rings?.radii.map((ring) => ring.hop)).toEqual([1, 2]);
  });

  it.each<{
    hops: ReadonlyMap<string, number>;
    label: string;
    positions: ReadonlyMap<string, RelationshipGraphPoint>;
  }>([
    {
      hops: new Map([...HOPS].filter(([id]) => id !== CHARACTER.root)),
      label: "no character sits at hop 0",
      positions: POSITIONS,
    },
    {
      hops: HOPS,
      label: "the root has no position",
      positions: new Map([...POSITIONS].filter(([id]) => id !== CHARACTER.root)),
    },
  ])("draws no rings when $label", ({ hops, positions }) => {
    expect(toGraphPersonRings({ hops, positions })).toBeNull();
  });

  it("places the label of a lone ring character on the opposite side of the root", () => {
    const hops = new Map<string, number>([
      [CHARACTER.nearEast, 1],
      [CHARACTER.root, 0],
    ]);
    const rings = toGraphPersonRings({ hops, positions: POSITIONS });

    expect(rings?.radii[0]?.labelAngle).toBeCloseTo(Math.PI);
  });
});

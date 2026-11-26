import { describe, expect, it } from "vitest";

import {
  toTreeArcGeometry,
  toTreeLineageGeometry,
  toTreeStraightGeometry,
} from "./graph-tree-edge-geometry";

describe("toTreeLineageGeometry", () => {
  it("runs from the bottom centre of the parent to the top centre of the child", () => {
    const geometry = toTreeLineageGeometry({
      child: { height: 60, width: 200, x: 300, y: 200 },
      parent: { height: 60, width: 200, x: 0, y: 0 },
    });

    expect(pathEnds(geometry.path)).toEqual({ end: [400, 200], start: [100, 60] });
  });

  it("draws a straight line between a parent and a child stacked in one column", () => {
    const geometry = toTreeLineageGeometry({
      child: { height: 60, width: 200, x: 0, y: 200 },
      parent: { height: 60, width: 200, x: 0, y: 0 },
    });

    expect(geometry.path).toBe("M 100 60 L 100 200");
  });
});

describe("toTreeStraightGeometry", () => {
  it("joins two boxes on one row at their facing sides", () => {
    const geometry = toTreeStraightGeometry({
      source: { height: 60, width: 200, x: 0, y: 0 },
      target: { height: 60, width: 200, x: 400, y: 0 },
    });

    expect(geometry.path).toBe("M 200 30 L 400 30");
  });

  it("leaves diagonal boxes at their borders rather than their centres", () => {
    const geometry = toTreeStraightGeometry({
      source: { height: 60, width: 200, x: 0, y: 0 },
      target: { height: 60, width: 200, x: 300, y: 300 },
    });

    expect(pathEnds(geometry.path)).toEqual({
      end: [expect.closeTo(370), expect.closeTo(300)],
      start: [expect.closeTo(130), expect.closeTo(60)],
    });
  });
});

describe("toTreeArcGeometry", () => {
  it("bends the connector as a cubic curve", () => {
    const geometry = toTreeArcGeometry({
      source: { height: 60, width: 200, x: 0, y: 100 },
      target: { height: 60, width: 200, x: 600, y: 120 },
    });

    expect(geometry.path).toMatch(/^M \S+ \S+ C /);
  });

  it("lifts the label above the tops of both boxes", () => {
    const geometry = toTreeArcGeometry({
      source: { height: 60, width: 200, x: 0, y: 100 },
      target: { height: 60, width: 200, x: 600, y: 120 },
    });

    expect(geometry.label.y).toBeLessThan(100);
  });
});

function pathEnds(path: string): { end: number[]; start: number[] } {
  const start: readonly string[] = /^M (\S+) (\S+)/.exec(path) ?? [];
  const end: readonly string[] = /L (\S+) (\S+)$/.exec(path) ?? [];
  return { end: end.slice(1).map(Number), start: start.slice(1).map(Number) };
}

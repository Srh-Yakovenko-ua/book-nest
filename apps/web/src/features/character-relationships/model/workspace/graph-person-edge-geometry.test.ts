import { describe, expect, it } from "vitest";

import type { GraphPersonCircle } from "./graph-person-edge-geometry";

import { toGraphPersonEdgeGeometry } from "./graph-person-edge-geometry";

const SOURCE: GraphPersonCircle = { center: { x: 0, y: 0 }, radius: 10 };

describe("toGraphPersonEdgeGeometry", () => {
  it("draws an undirected line between 4 px gaps around both circles, labelled halfway", () => {
    const geometry = toGraphPersonEdgeGeometry({
      isDirected: false,
      source: SOURCE,
      target: targetAt(100),
    });

    expect(geometry).toEqual({
      arrow: null,
      freeLength: 72,
      label: { x: 50, y: 0 },
      path: "M 14 0 L 86 0",
    });
  });

  it("puts the arrow tip of a directed line at the gap before the target", () => {
    const geometry = toGraphPersonEdgeGeometry({
      isDirected: true,
      source: SOURCE,
      target: targetAt(100),
    });

    expect(geometry?.arrow?.split(" ")[0]).toBe("86,0");
  });

  it("stops a directed line 10 px before its arrow tip", () => {
    const geometry = toGraphPersonEdgeGeometry({
      isDirected: true,
      source: SOURCE,
      target: targetAt(100),
    });

    expect(geometry?.path).toBe("M 14 0 L 76 0");
  });

  it.each([
    { distance: 15, label: "overlap" },
    { distance: 28, label: "sit only 8 px apart" },
  ])("draws nothing between circles that $label", ({ distance }) => {
    const geometry = toGraphPersonEdgeGeometry({
      isDirected: false,
      source: SOURCE,
      target: targetAt(distance),
    });

    expect(geometry).toBeNull();
  });

  it("draws a line once the circles sit more than 8 px apart", () => {
    const geometry = toGraphPersonEdgeGeometry({
      isDirected: false,
      source: SOURCE,
      target: targetAt(29),
    });

    expect(geometry?.freeLength).toBe(1);
  });
});

function targetAt(x: number): GraphPersonCircle {
  return { center: { x, y: 0 }, radius: 10 };
}

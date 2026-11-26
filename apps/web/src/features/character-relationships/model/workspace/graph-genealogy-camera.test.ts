import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenealogyZoomLevel } from "./graph-genealogy-camera";

import {
  isKeyGeneration,
  toGenealogyLabelStep,
  toGenealogyShortName,
  toGenealogyZoomLevel,
} from "./graph-genealogy-camera";

describe("toGenealogyZoomLevel", () => {
  it.each<{ level: GenealogyZoomLevel; zoom: number }>([
    { level: "overview", zoom: 0.1 },
    { level: "overview", zoom: 0.44 },
    { level: "exploration", zoom: 0.45 },
    { level: "exploration", zoom: 0.84 },
    { level: "details", zoom: 0.85 },
    { level: "details", zoom: 1.5 },
  ])("reads zoom $zoom as $level", ({ level, zoom }) => {
    expect(toGenealogyZoomLevel(zoom)).toBe(level);
  });
});

describe("toGenealogyShortName", () => {
  it.each<{
    displayName: string;
    houseName: Nullable<string>;
    name: string;
    qualifier: Nullable<string>;
  }>([
    {
      displayName: "Aegon II Targaryen",
      houseName: "Дім Targaryen",
      name: "Aegon II",
      qualifier: null,
    },
    { displayName: "Jon Snow", houseName: "Дім Старк", name: "Jon Snow", qualifier: null },
    {
      displayName: "Aegon II Targaryen",
      houseName: null,
      name: "Aegon II Targaryen",
      qualifier: null,
    },
    {
      displayName: "Jaehaerys Targaryen (son of Aegon II)",
      houseName: "Дім Targaryen",
      name: "Jaehaerys",
      qualifier: "son of Aegon II",
    },
    {
      displayName: "Daeron Targaryen (the Daring)",
      houseName: null,
      name: "Daeron Targaryen",
      qualifier: "the Daring",
    },
    { displayName: "(Unnamed)", houseName: null, name: "(Unnamed)", qualifier: null },
    { displayName: "Rhaego ()", houseName: null, name: "Rhaego", qualifier: null },
  ])(
    "shortens $displayName of house $houseName to $name with the namesake mark $qualifier",
    ({ displayName, houseName, name, qualifier }) => {
      expect(toGenealogyShortName({ displayName, houseName })).toEqual({ name, qualifier });
    },
  );
});

describe("toGenealogyLabelStep", () => {
  it.each<{ rowHeight: number; step: number }>([
    { rowHeight: 30, step: 1 },
    { rowHeight: 60, step: 1 },
    { rowHeight: 20, step: 2 },
    { rowHeight: 15, step: 5 },
    { rowHeight: 7, step: 10 },
    { rowHeight: 2, step: 10 },
  ])("labels every $step generation when a row is $rowHeight px tall", ({ rowHeight, step }) => {
    expect(toGenealogyLabelStep(rowHeight)).toBe(step);
  });
});

describe("isKeyGeneration", () => {
  it("keeps the first generation and every generation whose ordinal is a multiple of the step", () => {
    const ordinals = Array.from({ length: 21 }, (_, generation) => generation)
      .filter((generation) => isKeyGeneration({ generation, step: 5 }))
      .map((generation) => generation + 1);

    expect(ordinals).toEqual([1, 5, 10, 15, 20]);
  });

  it("skips the first generation when every second one is labelled, so labels never touch", () => {
    const ordinals = Array.from({ length: 8 }, (_, generation) => generation)
      .filter((generation) => isKeyGeneration({ generation, step: 2 }))
      .map((generation) => generation + 1);

    expect(ordinals).toEqual([2, 4, 6, 8]);
  });

  it("keeps every generation when the step is one", () => {
    expect([0, 1, 2, 3].every((generation) => isKeyGeneration({ generation, step: 1 }))).toBe(true);
  });
});

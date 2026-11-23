import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenealogyZoomLevel } from "./graph-genealogy-camera";

import { toGenealogyShortName, toGenealogyZoomLevel } from "./graph-genealogy-camera";

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
  it.each<{ displayName: string; houseName: Nullable<string>; shortName: string }>([
    { displayName: "Aegon II Targaryen", houseName: "Дім Targaryen", shortName: "Aegon II" },
    { displayName: "Jon Snow", houseName: "Дім Старк", shortName: "Jon Snow" },
    { displayName: "Aegon II Targaryen", houseName: null, shortName: "Aegon II Targaryen" },
  ])(
    "shortens $displayName of house $houseName to $shortName",
    ({ displayName, houseName, shortName }) => {
      expect(toGenealogyShortName({ displayName, houseName })).toBe(shortName);
    },
  );
});

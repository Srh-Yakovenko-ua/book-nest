import type { Nullable } from "@app/shared";

export const GENEALOGY_CAMERA = {
  firstKeyLabelStep: 5,
  focusZoom: 0.9,
  initialZoom: 0.6,
  keyLabelSpacing: 40,
  keyLabelSteps: [2, 5, 10],
  minZoom: 0.05,
  railLabelMinRow: 30,
  zoomLevels: { details: 0.85, exploration: 0.45 },
} as const;

export type GenealogyShortName = {
  name: string;
  qualifier: Nullable<string>;
};

export type GenealogyZoomLevel = "details" | "exploration" | "overview";

export function isKeyGeneration({ generation, step }: { generation: number; step: number }) {
  if ((generation + 1) % step === 0) return true;
  return generation === 0 && step >= GENEALOGY_CAMERA.firstKeyLabelStep;
}

export function toGenealogyLabelStep(rowHeight: number): number {
  if (rowHeight >= GENEALOGY_CAMERA.railLabelMinRow) return 1;
  const step = GENEALOGY_CAMERA.keyLabelSteps.find(
    (candidate) => rowHeight * candidate >= GENEALOGY_CAMERA.keyLabelSpacing,
  );
  return step ?? GENEALOGY_CAMERA.keyLabelSteps.at(-1) ?? 1;
}

export function toGenealogyShortName({
  displayName,
  houseName,
}: {
  displayName: string;
  houseName: Nullable<string>;
}): GenealogyShortName {
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/u.exec(displayName);
  const bare = (match?.[1] ?? displayName).trim();
  if (bare.length === 0) return { name: displayName, qualifier: null };
  const inner = match?.[2]?.trim() ?? "";
  const qualifier = inner.length === 0 ? null : inner;
  return { name: withoutHouseWord({ houseName, name: bare }), qualifier };
}

export function toGenealogyZoomLevel(zoom: number): GenealogyZoomLevel {
  if (zoom >= GENEALOGY_CAMERA.zoomLevels.details) return "details";
  return zoom >= GENEALOGY_CAMERA.zoomLevels.exploration ? "exploration" : "overview";
}

function withoutHouseWord({ houseName, name }: { houseName: Nullable<string>; name: string }) {
  const houseWord = houseName?.trim().split(/\s+/).at(-1);
  if (houseWord === undefined || houseWord.length === 0) return name;
  const words = name.split(/\s+/);
  const last = words.at(-1);
  if (words.length < 2 || last === undefined) return name;
  return last.toLocaleLowerCase() === houseWord.toLocaleLowerCase()
    ? words.slice(0, -1).join(" ")
    : name;
}

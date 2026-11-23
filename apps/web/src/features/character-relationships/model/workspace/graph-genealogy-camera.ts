import type { Nullable } from "@app/shared";

export const GENEALOGY_CAMERA = {
  focusZoom: 0.9,
  initialZoom: 0.6,
  minZoom: 0.05,
  railLabelMinRow: 30,
  zoomLevels: { details: 0.85, exploration: 0.45 },
} as const;

export type GenealogyZoomLevel = "details" | "exploration" | "overview";

export function toGenealogyShortName({
  displayName,
  houseName,
}: {
  displayName: string;
  houseName: Nullable<string>;
}): string {
  const bare = displayName.replace(/\s*\([^()]*\)\s*$/u, "").trim();
  const name = bare.length === 0 ? displayName : bare;
  const houseWord = houseName?.trim().split(/\s+/).at(-1);
  if (houseWord === undefined || houseWord.length === 0) return name;
  const words = name.split(/\s+/);
  const last = words.at(-1);
  if (words.length < 2 || last === undefined) return name;
  return last.toLocaleLowerCase() === houseWord.toLocaleLowerCase()
    ? words.slice(0, -1).join(" ")
    : name;
}

export function toGenealogyZoomLevel(zoom: number): GenealogyZoomLevel {
  if (zoom >= GENEALOGY_CAMERA.zoomLevels.details) return "details";
  return zoom >= GENEALOGY_CAMERA.zoomLevels.exploration ? "exploration" : "overview";
}

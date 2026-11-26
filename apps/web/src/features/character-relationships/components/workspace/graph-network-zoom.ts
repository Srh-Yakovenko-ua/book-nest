import { assertNever } from "@/lib/assert-never";

export const NETWORK_ZOOM = {
  detailsFrom: 0.85,
  explorationFrom: 0.5,
  hysteresis: 0.05,
  initialBand: "details",
} as const;

export type NetworkZoomBand = "details" | "exploration" | "overview";

export function toNetworkZoomBand({
  current,
  zoom,
}: {
  current: NetworkZoomBand;
  zoom: number;
}): NetworkZoomBand {
  const { detailsFrom, explorationFrom, hysteresis } = NETWORK_ZOOM;
  switch (current) {
    case "details":
      if (zoom < explorationFrom - hysteresis) return "overview";
      return zoom < detailsFrom - hysteresis ? "exploration" : "details";
    case "exploration":
      if (zoom >= detailsFrom) return "details";
      return zoom < explorationFrom - hysteresis ? "overview" : "exploration";
    case "overview":
      if (zoom >= detailsFrom) return "details";
      return zoom >= explorationFrom ? "exploration" : "overview";
    default:
      return assertNever(current);
  }
}
